import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import type { User } from '../types/auth'

function makeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ sub: '1', exp }))
  return `${header}.${payload}.signature`
}

const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  displayName: 'Test User',
  locale: 'en',
}

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  })

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
  })

  it('login sets token, user, and isAuthenticated', () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600)
    useAuthStore.getState().login(token, mockUser)

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.token).toBe(token)
    expect(state.user).toEqual(mockUser)
  })

  it('login persists to localStorage', () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600)
    useAuthStore.getState().login(token, mockUser)

    expect(localStorage.getItem('wireframes_token')).toBe(token)
    expect(JSON.parse(localStorage.getItem('wireframes_user')!)).toEqual(mockUser)
  })

  it('logout clears state and localStorage', () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600)
    useAuthStore.getState().login(token, mockUser)
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(localStorage.getItem('wireframes_token')).toBeNull()
    expect(localStorage.getItem('wireframes_user')).toBeNull()
  })

  it('setToken updates token and marks authenticated', () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600)
    useAuthStore.getState().setToken(token)

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.token).toBe(token)
  })

  it('setUser updates user in state and localStorage', () => {
    useAuthStore.getState().setUser(mockUser)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(JSON.parse(localStorage.getItem('wireframes_user')!)).toEqual(mockUser)
  })
})
