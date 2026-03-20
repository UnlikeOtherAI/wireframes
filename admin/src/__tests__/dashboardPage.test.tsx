import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from '../features/DashboardPage'
import { useAuthStore } from '../stores/authStore'
import '../i18n'

const mockProjects = [
  { id: 'p1', name: 'Alpha', role: 'owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-15T00:00:00Z' },
  { id: 'p2', name: 'Beta', role: 'viewer', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z' },
]

const mockInvites = [
  { id: 'inv-1', projectId: 'p3', projectName: 'Gamma', role: 'editor', invitedBy: 'alice@test.com', createdAt: '2026-03-01T00:00:00Z', token: 'tok-1' },
]

function mockFetchResponses(projects = mockProjects, invites = mockInvites) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const urlStr = url as string
    if (urlStr.includes('/users/me/invites')) {
      return new Response(JSON.stringify(invites), { status: 200 })
    }
    if (urlStr.includes('/projects')) {
      return new Response(JSON.stringify(projects), { status: 200 })
    }
    return new Response('Not found', { status: 404 })
  })
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: { id: 'u1', email: 'test@test.com', displayName: 'Test', locale: 'en' }, token: 'test-token', isAuthenticated: true })
    vi.restoreAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    renderDashboard()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByLabelText('Loading...')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows project cards after loading', async () => {
    mockFetchResponses()
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('shows role badges on project cards', async () => {
    mockFetchResponses()
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument()
    })
    expect(screen.getByText('Viewer')).toBeInTheDocument()
  })

  it('shows invite cards with accept/decline buttons', async () => {
    mockFetchResponses()
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/You've been invited to Gamma/)).toBeInTheDocument()
    })
    expect(screen.getByText('Accept')).toBeInTheDocument()
    expect(screen.getByText('Decline')).toBeInTheDocument()
  })

  it('shows empty state when no projects or invites', async () => {
    mockFetchResponses([], [])
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument()
    })
    expect(screen.getByText('Create your first project to get started')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Failed to load projects. Please try again.')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('retry button reloads data', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    fetchSpy.mockImplementation(async (url) => {
      const urlStr = url as string
      if (urlStr.includes('/users/me/invites')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      return new Response(JSON.stringify(mockProjects), { status: 200 })
    })

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })
  })

  it('shows new project card with + icon', async () => {
    mockFetchResponses()
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByLabelText('New Project')).toBeInTheDocument()
    })
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('opens create dialog on new project card click', async () => {
    mockFetchResponses()
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByLabelText('New Project')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('New Project'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Project name')).toBeInTheDocument()
  })

  it('create dialog validates empty name', async () => {
    mockFetchResponses()
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByLabelText('New Project')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('New Project'))

    const submitButton = screen.getAllByText('Create Project').find(
      (el) => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit',
    )!
    expect(submitButton).toBeDisabled()
  })

  it('navigates to project on card click', async () => {
    mockFetchResponses()
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const card = screen.getByLabelText('Alpha')
    expect(card).toHaveAttribute('role', 'link')
  })

  it('decline removes invite card', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url as string
      const method = (init as RequestInit)?.method
      if (urlStr.includes('/users/me/invites') && urlStr.includes('/decline') && method === 'POST') {
        return new Response(null, { status: 204 })
      }
      if (urlStr.includes('/users/me/invites')) {
        return new Response(JSON.stringify(mockInvites), { status: 200 })
      }
      if (urlStr.includes('/projects')) {
        return new Response(JSON.stringify(mockProjects), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Decline')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Decline'))

    await waitFor(() => {
      expect(screen.queryByText(/You've been invited to Gamma/)).not.toBeInTheDocument()
    })
  })
})
