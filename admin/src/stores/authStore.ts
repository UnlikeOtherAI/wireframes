import { create } from 'zustand'
import type { AuthState, User } from '../types/auth'
import { isTokenExpired } from '../utils/jwt'

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
  const token = getStorage()?.getItem(TOKEN_KEY) ?? null
  if (token && isTokenExpired(token)) {
    getStorage()?.removeItem(TOKEN_KEY)
    getStorage()?.removeItem(USER_KEY)
    return null
  }
  return token
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

const initialToken = loadToken()
const initialUser = initialToken ? loadUser() : null

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: initialToken,
  isAuthenticated: initialToken !== null,

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

  updateUser: (user: User) => {
    getStorage()?.setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },
}))
