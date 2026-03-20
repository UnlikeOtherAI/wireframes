export interface User {
  id: string
  email: string
  displayName: string
  locale: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setToken: (token: string) => void
  setUser: (user: User) => void
}
