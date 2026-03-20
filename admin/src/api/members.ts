import { apiFetch } from './client'

export interface Member {
  userId: string
  email: string
  displayName: string
  role: string
}

export function listMembers(projectId: string): Promise<Member[]> {
  return apiFetch<Member[]>(
    `/projects/${encodeURIComponent(projectId)}/members`,
  )
}

export function inviteMember(
  projectId: string,
  email: string,
  role: string,
): Promise<void> {
  return apiFetch<void>(
    `/projects/${encodeURIComponent(projectId)}/invite`,
    {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    },
  )
}

export function updateMemberRole(
  projectId: string,
  userId: string,
  role: string,
): Promise<void> {
  return apiFetch<void>(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  )
}

export function removeMember(
  projectId: string,
  userId: string,
): Promise<void> {
  return apiFetch<void>(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    },
  )
}
