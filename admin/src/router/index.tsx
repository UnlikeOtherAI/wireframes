import { createBrowserRouter } from 'react-router-dom'
import { AuthGuard } from './guards'
import { LoginPage } from '../features/LoginPage'
import { AuthCallbackPage } from '../features/AuthCallbackPage'
import { DashboardPage } from '../features/DashboardPage'
import { ProjectEditorPage } from '../features/ProjectEditorPage'
import { ProjectSettingsPage } from '../features/ProjectSettingsPage'
import { MembersPage } from '../features/MembersPage'
import { PreviewSettingsPage } from '../features/PreviewSettingsPage'
import { AccountPage } from '../features/AccountPage'

export const router = createBrowserRouter([
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
      { path: '/', element: <DashboardPage /> },
      { path: '/projects/:id', element: <ProjectEditorPage /> },
      { path: '/projects/:id/settings', element: <ProjectSettingsPage /> },
      { path: '/projects/:id/members', element: <MembersPage /> },
      { path: '/projects/:id/preview', element: <PreviewSettingsPage /> },
      { path: '/account', element: <AccountPage /> },
    ],
  },
])
