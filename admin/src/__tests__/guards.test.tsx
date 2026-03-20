import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { AuthGuard } from '../router/guards'

function LoginCapture() {
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  return (
    <div data-testid="login-page">
      Login
      {returnUrl && <span data-testid="return-url">{returnUrl}</span>}
    </div>
  )
}

function renderWithRouter(initialRoute: string, isAuthenticated: boolean) {
  if (isAuthenticated) {
    useAuthStore.setState({ token: 'tok', isAuthenticated: true, user: null })
  }

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<LoginCapture />} />
        <Route element={<AuthGuard />}>
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
          <Route path="/projects/:id" element={<div data-testid="project">Project</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthGuard', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  })

  it('redirects unauthenticated users to /login', () => {
    renderWithRouter('/', false)
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders protected content for authenticated users', () => {
    renderWithRouter('/', true)
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })

  it('preserves return URL when redirecting to login', () => {
    renderWithRouter('/projects/42', false)
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.getByTestId('return-url')).toHaveTextContent('/projects/42')
  })

  it('does not add returnUrl param for root path', () => {
    renderWithRouter('/', false)
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('return-url')).toBeNull()
  })
})
