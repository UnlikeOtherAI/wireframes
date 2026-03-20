import { describe, it, expect, beforeEach, vi } from 'vitest'

function encodePayload(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

describe('authStore JWT expiry on load', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset the module registry so authStore re-evaluates initial state
    vi.resetModules()
  })

  it('clears expired token from localStorage on store initialization', async () => {
    const expiredToken = encodePayload({
      exp: Math.floor(Date.now() / 1000) - 3600,
    })
    localStorage.setItem('wireframes_token', expiredToken)
    localStorage.setItem('wireframes_user', JSON.stringify({ id: '1', email: 'a@b.com', displayName: 'A', locale: 'en' }))

    const { useAuthStore } = await import('../stores/authStore')
    const state = useAuthStore.getState()

    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBeNull()
    expect(localStorage.getItem('wireframes_token')).toBeNull()
  })

  it('keeps valid token on store initialization', async () => {
    const validToken = encodePayload({
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    localStorage.setItem('wireframes_token', validToken)
    localStorage.setItem('wireframes_user', JSON.stringify({ id: '1', email: 'a@b.com', displayName: 'A', locale: 'en' }))

    const { useAuthStore } = await import('../stores/authStore')
    const state = useAuthStore.getState()

    expect(state.isAuthenticated).toBe(true)
    expect(state.token).toBe(validToken)
  })
})
