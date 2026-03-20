import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import { listPendingInvites, acceptInvite, declineInvite } from '../api/invites'

describe('invites API', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, token: 'test-token', isAuthenticated: true })
    vi.restoreAllMocks()
  })

  it('listPendingInvites calls GET /users/me/invites', async () => {
    const invites = [{ id: '1', projectId: 'p1', projectName: 'My Project', role: 'editor', invitedBy: 'alice@test.com', createdAt: '2026-01-01', token: 'tok1' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(invites), { status: 200 }),
    )

    const result = await listPendingInvites()
    expect(result).toEqual(invites)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect((url as string).endsWith('/users/me/invites')).toBe(true)
    expect(init?.method).toBeUndefined()
  })

  it('acceptInvite calls POST /invites/:token/accept', async () => {
    const project = { id: 'p1', name: 'My Project', role: 'editor', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(project), { status: 200 }),
    )

    const result = await acceptInvite('my-token')
    expect(result).toEqual(project)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect((url as string).includes('/invites/my-token/accept')).toBe(true)
    expect(init?.method).toBe('POST')
  })

  it('declineInvite calls POST /users/me/invites/:id/decline', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await declineInvite('inv-1')

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect((url as string).includes('/users/me/invites/inv-1/decline')).toBe(true)
    expect(init?.method).toBe('POST')
  })
})
