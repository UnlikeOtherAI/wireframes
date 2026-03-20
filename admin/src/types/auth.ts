export interface User {
  id: string
  email: string
  displayName: string
  locale: string
}

export interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  updateUser: (user: User) => void
  setToken: (token: string, refreshToken: string) => void
}
