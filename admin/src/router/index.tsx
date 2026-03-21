import { createBrowserRouter } from 'react-router-dom'
import { AuthGuard } from './guards'
import { LoginPage } from '../features/LoginPage'
import { AuthCallbackPage } from '../features/AuthCallbackPage'
import { AppShell } from '../features/AppShell'
import { DashboardPage } from '../features/DashboardPage'
import { ProjectEditorPage } from '../features/ProjectEditorPage'
import { ProjectSettingsPage } from '../features/ProjectSettingsPage'
import { AccountPage } from '../features/AccountPage'
import { ErrorBoundaryPage } from '../features/ErrorBoundaryPage'

export const router = createBrowserRouter([
  {
    errorElement: <ErrorBoundaryPage />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/auth/callback',
        element: <AuthCallbackPage />,
      },
      {
        element: <AuthGuard />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/projects/:id', element: <ProjectEditorPage /> },
              { path: '/projects/:id/settings', element: <ProjectSettingsPage /> },
              { path: '/account', element: <AccountPage /> },
            ],
          },
        ],
      },
    ],
  },
])
