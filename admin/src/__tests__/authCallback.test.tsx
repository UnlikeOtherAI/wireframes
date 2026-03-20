import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { AuthCallbackPage } from '../features/AuthCallbackPage'
import '../i18n'

vi.mock('../api/auth', () => ({
  exchangeSsoToken: vi.fn(),
  updateLocale: vi.fn(),
}))

const { exchangeSsoToken } = await import('../api/auth')
const mockExchange = vi.mocked(exchangeSsoToken)

function renderCallback(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/projects/:id" element={<div data-testid="project">Project</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
    vi.clearAllMocks()
  })

  it('exchanges SSO token and redirects to dashboard', async () => {
    mockExchange.mockResolvedValue({
      token: 'jwt-123',
      user: { id: '1', email: 'a@b.com', displayName: 'Alice', locale: 'en' },
    })

    renderCallback('/auth/callback?token=sso-token')

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    expect(mockExchange).toHaveBeenCalledWith('sso-token')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().token).toBe('jwt-123')
  })

  it('redirects to returnUrl after successful login', async () => {
    mockExchange.mockResolvedValue({
      token: 'jwt-123',
      user: { id: '1', email: 'a@b.com', displayName: 'Alice', locale: 'en' },
    })

    renderCallback('/auth/callback?token=sso-token&returnUrl=%2Fprojects%2F42')

    await waitFor(() => {
      expect(screen.getByTestId('project')).toBeInTheDocument()
    })
  })

  it('shows error when no token is provided', () => {
    renderCallback('/auth/callback')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Authentication failed',
    )
  })

  it('shows error on API failure', async () => {
    mockExchange.mockRejectedValue(new Error('Network error'))

    renderCallback('/auth/callback?token=bad-token')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
