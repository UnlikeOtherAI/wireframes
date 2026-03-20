import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../features/LoginPage'
import '../i18n'

describe('LoginPage', () => {
  let locationHref: string

  beforeEach(() => {
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
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Sign in')
  })

  it('redirects to SSO provider on click', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(window.location.href).toContain('authenticator.unlikeother.ai')
    expect(window.location.href).toContain('callback')
  })

  it('includes returnUrl in SSO callback when present', () => {
    render(
      <MemoryRouter initialEntries={['/login?returnUrl=%2Fprojects%2F42']}>
        <LoginPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button'))
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
    const button = screen.getByRole('button')
    expect(button.style.minWidth).toBe('44px')
    expect(button.style.minHeight).toBe('44px')
  })
})
