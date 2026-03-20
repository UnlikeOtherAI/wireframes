import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from '../features/LoginPage'
import { useAuthStore } from '../stores/authStore'
import '../i18n'

const devLoginMock = vi.fn()

vi.mock('../api/auth', () => ({
  devLogin: () => devLoginMock(),
}))

describe('LoginPage', () => {
  let locationHref: string

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false })
    locationHref = window.location.href
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: locationHref, origin: 'http://localhost:3000' },
      writable: true,
      configurable: true,
    })
  })

  it('renders sign in button', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('login-card')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Get started' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Get started')
  })

  it('redirects to SSO provider on click', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    expect(window.location.href).toContain('authenticator.unlikeother.ai')
    expect(window.location.href).toContain('callback')
  })

  it('includes returnUrl in SSO callback when present', () => {
    render(
      <MemoryRouter initialEntries={['/login?returnUrl=%2Fprojects%2F42']}>
        <LoginPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    const href = window.location.href
    expect(href).toContain('returnUrl')
    const callbackParam = new URL(href).searchParams.get('callback')!
    const callbackUrl = new URL(callbackParam)
    expect(callbackUrl.searchParams.get('returnUrl')).toBe('/projects/42')
  })

  it('has minimum 44px button size for accessibility', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: 'Get started' })
    expect(button.style.minWidth).toBe('44px')
    expect(button.style.minHeight).toBe('44px')
  })

  it('renders a centered card-style login layout', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    const card = screen.getByTestId('login-card')
    expect(card.style.maxWidth).toBe('420px')
    expect(card.style.padding).toBe('20px')
    expect(card.style.background).toBe('rgb(255, 255, 255)')
  })

  it('renders dev login button when enabled', () => {
    vi.stubEnv('VITE_DEV_AUTH_ENABLED', 'true')

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Dev login' })).toBeInTheDocument()
  })

  it('does not render dev login button when disabled', () => {
    vi.stubEnv('VITE_DEV_AUTH_ENABLED', 'false')

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: 'Dev login' })).toBeNull()
  })

  it('logs in with dev login and redirects', async () => {
    vi.stubEnv('VITE_DEV_AUTH_ENABLED', 'true')
    devLoginMock.mockResolvedValue({
      token: 'jwt-dev',
      user: { id: '1', email: 'dev@wireframes.local', displayName: 'Local Developer', locale: 'en' },
    })

    render(
      <MemoryRouter initialEntries={['/login?returnUrl=%2Fprojects%2F42']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects/42" element={<div>Project</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dev login' }))

    await waitFor(() => {
      expect(screen.getByText('Project')).toBeInTheDocument()
    })
    expect(useAuthStore.getState().token).toBe('jwt-dev')
  })
})
