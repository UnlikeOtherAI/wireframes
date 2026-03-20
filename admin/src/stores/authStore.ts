import { create } from 'zustand'
import type { AuthState, User } from '../types/auth'

const TOKEN_KEY = 'wireframes_token'
const USER_KEY = 'wireframes_user'

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage
    }
    return null
  } catch {
    return null
  }
}

function loadToken(): string | null {
  return getStorage()?.getItem(TOKEN_KEY) ?? null
}

function loadUser(): User | null {
  const raw = getStorage()?.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function getInitialState(): { token: string | null; user: User | null } {
  const token = loadToken()
  if (token && !isTokenExpired(token)) {
    return { token, user: loadUser() }
  }
  const storage = getStorage()
  storage?.removeItem(TOKEN_KEY)
  storage?.removeItem(USER_KEY)
  return { token: null, user: null }
}

const initial = getInitialState()

export const useAuthStore = create<AuthState>((set) => ({
  user: initial.user,
  token: initial.token,
  isAuthenticated: initial.token !== null,

  login: (token: string, user: User) => {
    const storage = getStorage()
    storage?.setItem(TOKEN_KEY, token)
    storage?.setItem(USER_KEY, JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    const storage = getStorage()
    storage?.removeItem(TOKEN_KEY)
    storage?.removeItem(USER_KEY)
    set({ token: null, user: null, isAuthenticated: false })
  },

  setToken: (token: string) => {
    getStorage()?.setItem(TOKEN_KEY, token)
    set({ token, isAuthenticated: true })
  },

  setUser: (user: User) => {
    getStorage()?.setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },
}))
