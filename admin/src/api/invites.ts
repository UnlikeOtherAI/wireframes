import { apiFetch } from './client'
import type { Project } from './projects'

export interface PendingInvite {
  id: string
  projectId: string
  projectName: string
  role: string
  invitedBy: string
  createdAt: string
  token: string
}

export function listPendingInvites(): Promise<PendingInvite[]> {
  return apiFetch<PendingInvite[]>('/users/me/invites')
}

export function acceptInvite(token: string): Promise<Project> {
  return apiFetch<Project>(`/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  })
}

export function declineInvite(id: string): Promise<void> {
  return apiFetch<void>(`/users/me/invites/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
  })
}
