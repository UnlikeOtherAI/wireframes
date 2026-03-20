import { apiFetch } from './client'
import type { User } from '../types/auth'

export function updateProfile(displayName: string): Promise<User> {
  return apiFetch<User>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  })
}

export function deleteAccount(email: string): Promise<void> {
  return apiFetch<void>('/users/me', {
    method: 'DELETE',
    headers: { 'X-Confirm-Delete': email },
  })
}
