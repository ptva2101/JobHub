import { createContext } from 'react'
import type { LoginCredentials, RegisterPayload } from '../types/auth'
import type { AuthUser, User } from '../types/user'

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<AuthUser>
  register: (payload: RegisterPayload) => Promise<AuthUser>
  updateCurrentUser: (payload: Partial<User>) => Promise<AuthUser>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
