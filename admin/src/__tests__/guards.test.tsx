import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { AuthGuard } from '../router/guards'

function renderWithRouter(initialRoute: string, isAuthenticated: boolean) {
  if (isAuthenticated) {
    useAuthStore.setState({ token: 'tok', isAuthenticated: true, user: null })
  }

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
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
})
