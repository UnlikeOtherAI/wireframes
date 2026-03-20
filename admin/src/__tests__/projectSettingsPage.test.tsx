import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProjectSettingsPage } from '../features/ProjectSettingsPage'
import { useAuthStore } from '../stores/authStore'
import '../i18n'

const mockProject = {
  id: 'p1',
  name: 'Test Project',
  role: 'owner',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-15T00:00:00Z',
}

const mockMembers = [
  { userId: 'u1', email: 'owner@test.com', displayName: 'Owner User', role: 'owner' },
  { userId: 'u2', email: 'editor@test.com', displayName: 'Editor User', role: 'editor' },
]

const mockPreview = {
  slug: 'abc123',
  url: 'https://preview.example.com/abc123',
  accessMode: 'public' as const,
  publishedAt: '2026-03-10T00:00:00Z',
  emailAccessList: [],
}

function mockFetchResponses(
  project = mockProject,
  members = mockMembers,
  preview: unknown = mockPreview,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = url as string
    const method = (init as RequestInit)?.method ?? 'GET'
    if (urlStr.includes('/members') && method === 'GET') {
      return new Response(JSON.stringify(members), { status: 200 })
    }
    if (urlStr.includes('/preview') && method === 'GET') {
      if (!preview) return new Response('Not found', { status: 404 })
      return new Response(JSON.stringify(preview), { status: 200 })
    }
    if (urlStr.includes('/projects/') && method === 'GET') {
      return new Response(JSON.stringify(project), { status: 200 })
    }
    if (urlStr.includes('/projects/') && method === 'PATCH') {
      const body = JSON.parse((init as RequestInit).body as string)
      return new Response(JSON.stringify({ ...project, name: body.name }), { status: 200 })
    }
    if (urlStr.includes('/projects/') && method === 'DELETE') {
      return new Response(null, { status: 204 })
    }
    if (urlStr.includes('/invite') && method === 'POST') {
      return new Response(JSON.stringify({ id: 'inv-new' }), { status: 201 })
    }
    if (urlStr.includes('/members/') && method === 'PATCH') {
      return new Response(JSON.stringify({ userId: 'u2', role: 'viewer' }), { status: 200 })
    }
    if (urlStr.includes('/members/') && method === 'DELETE') {
      return new Response(null, { status: 204 })
    }
    return new Response('Not found', { status: 404 })
  })
}

function renderSettings(role = 'owner') {
  const project = { ...mockProject, role }
  mockFetchResponses(project)

  return render(
    <MemoryRouter initialEntries={['/projects/p1/settings']}>
      <Routes>
        <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProjectSettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: { id: 'u1', email: 'owner@test.com', displayName: 'Owner User', locale: 'en' },
      token: 'test-token',
      isAuthenticated: true,
    })
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    render(
      <MemoryRouter initialEntries={['/projects/p1/settings']}>
        <Routes>
          <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Project Settings')).toBeInTheDocument()
    expect(screen.getByLabelText('Loading...')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows error state on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'))
    render(
      <MemoryRouter initialEntries={['/projects/p1/settings']}>
        <Routes>
          <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load project settings. Please try again.')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows all sections for owner', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument()
    })
    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getByText('Preview Settings')).toBeInTheDocument()
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
  })

  it('shows limited sections for editor', async () => {
    renderSettings('editor')
    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument()
    })
    expect(screen.getByText('Preview Settings')).toBeInTheDocument()
    expect(screen.queryByText('Members')).not.toBeInTheDocument()
    expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument()
  })

  it('shows read-only notice for viewer', async () => {
    renderSettings('viewer')
    await waitFor(() => {
      expect(screen.getByText('You have view-only access to this project.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Members')).not.toBeInTheDocument()
    expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument()
    expect(screen.queryByText('Preview Settings')).not.toBeInTheDocument()
  })

  it('rename project works for editor+', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument()
    })
    const input = screen.getByLabelText('Project name')
    fireEvent.change(input, { target: { value: 'Renamed Project' } })
    const saveBtn = screen.getAllByText('Save').find((el) => el.tagName === 'BUTTON')!
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(screen.getByText('Changes saved')).toBeInTheDocument()
    })
  })

  it('shows member list for owner', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByText('Owner User')).toBeInTheDocument()
    })
    expect(screen.getByText('Editor User')).toBeInTheDocument()
  })

  it('invite member shows success message', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByText('Invite member')).toBeInTheDocument()
    })
    const emailInput = screen.getByLabelText('Email address')
    fireEvent.change(emailInput, { target: { value: 'new@test.com' } })
    const inviteBtn = screen.getByText('Invite')
    fireEvent.click(inviteBtn)
    await waitFor(() => {
      expect(screen.getByText('Invite sent')).toBeInTheDocument()
    })
  })

  it('delete project requires name confirmation', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByText('Delete project')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Delete project'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    const deleteBtn = screen.getAllByText('Delete').find(
      (el) => el.tagName === 'BUTTON' && el.closest('[role="dialog"]'),
    )!
    expect(deleteBtn).toBeDisabled()

    const confirmInput = screen.getByLabelText('Type the project name to confirm deletion:')
    fireEvent.change(confirmInput, { target: { value: 'Test Project' } })
    expect(deleteBtn).not.toBeDisabled()
  })

  it('back to dashboard button navigates to /', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByText('Back to dashboard')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Back to dashboard'))
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('shows preview share link and copy button', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByDisplayValue('https://preview.example.com/abc123')).toBeInTheDocument()
    })
    expect(screen.getByText('Copy link')).toBeInTheDocument()
  })

  it('shows last published timestamp', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByText(/Last published:/)).toBeInTheDocument()
    })
  })

  it('shows "not published yet" when no publishedAt', async () => {
    const noPublishPreview = { ...mockPreview, publishedAt: null, slug: null, url: null }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url as string
      if (urlStr.includes('/members')) {
        return new Response(JSON.stringify(mockMembers), { status: 200 })
      }
      if (urlStr.includes('/preview')) {
        return new Response(JSON.stringify(noPublishPreview), { status: 200 })
      }
      return new Response(JSON.stringify(mockProject), { status: 200 })
    })

    render(
      <MemoryRouter initialEntries={['/projects/p1/settings']}>
        <Routes>
          <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Not published yet')).toBeInTheDocument()
    })
  })

  it('remove member shows confirm then removes', async () => {
    renderSettings('owner')
    await waitFor(() => {
      expect(screen.getByText('Editor User')).toBeInTheDocument()
    })
    const deleteBtns = screen.getAllByLabelText('Remove member')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => {
      expect(screen.queryByText('Editor User')).not.toBeInTheDocument()
    })
  })
})
