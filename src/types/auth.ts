import type { AuthUser, UserRole } from './user'

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload extends LoginCredentials {
  fullName: string
  phone: string
  role: Exclude<UserRole, 'admin'>
  companyName?: string
}

export interface AuthSession {
  user: AuthUser
  createdAt: string
}
