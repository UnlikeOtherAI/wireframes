import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import type { User } from '../types/auth'

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
    useAuthStore.getState().login('test-token', mockUser)

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.token).toBe('test-token')
    expect(state.user).toEqual(mockUser)
  })

  it('login persists to localStorage', () => {
    useAuthStore.getState().login('test-token', mockUser)

    expect(localStorage.getItem('wireframes_token')).toBe('test-token')
    expect(JSON.parse(localStorage.getItem('wireframes_user')!)).toEqual(mockUser)
  })

  it('logout clears state and localStorage', () => {
    useAuthStore.getState().login('test-token', mockUser)
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(localStorage.getItem('wireframes_token')).toBeNull()
    expect(localStorage.getItem('wireframes_user')).toBeNull()
  })
})
