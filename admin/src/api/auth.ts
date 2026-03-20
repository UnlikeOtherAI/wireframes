import { apiFetch } from './client'
import type { User } from '../types/auth'

interface SsoResponse {
  token: string
  user: User
}

export function exchangeSsoToken(ssoToken: string): Promise<SsoResponse> {
  return apiFetch<SsoResponse>('/auth/sso', {
    method: 'POST',
    body: JSON.stringify({ token: ssoToken }),
  })
}

export function updateLocale(locale: string): Promise<void> {
  return apiFetch<void>('/users/me/locale', {
    method: 'PATCH',
    body: JSON.stringify({ locale }),
  })
}
