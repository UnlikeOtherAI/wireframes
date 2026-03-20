import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    const returnUrl = location.pathname + location.search
    const to = returnUrl === '/' ? '/login' : `/login?returnUrl=${encodeURIComponent(returnUrl)}`
    return <Navigate to={to} replace />
  }

  return <Outlet />
}
