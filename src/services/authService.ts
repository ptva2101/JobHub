import type { LoginCredentials, RegisterPayload } from '../types/auth'
import type { AuthUser, User } from '../types/user'
import { generateId } from '../utils/generateId'
import { apiClient } from './apiClient'

function sanitizeUser(user: User): AuthUser {
  const { password, ...authUser } = user
  void password
  return { ...authUser, accountStatus: authUser.accountStatus ?? 'active' }
}

function isLocked(user: Pick<User, 'accountStatus'>) {
  return user.accountStatus === 'locked'
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const email = credentials.email.trim().toLowerCase()
    const users = await apiClient.get<User[]>(`/users?email=${encodeURIComponent(email)}`)
    const user = users.find((item) => item.password === credentials.password)

    if (!user) {
      throw new Error('Email hoặc mật khẩu không chính xác.')
    }
    if (isLocked(user)) {
      throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.')
    }

    return sanitizeUser(user)
  },

  async register(payload: RegisterPayload): Promise<AuthUser> {
    const email = payload.email.trim().toLowerCase()
    const existingUsers = await apiClient.get<User[]>(
      `/users?email=${encodeURIComponent(email)}`,
    )

    if (existingUsers.length > 0) {
      throw new Error('Email này đã được sử dụng.')
    }

    const now = new Date().toISOString()
    const isCandidate = payload.role === 'candidate'
    const newUser: User = {
      id: generateId('user'),
      email,
      password: payload.password,
      role: payload.role,
      fullName: payload.fullName.trim(),
      phone: payload.phone.trim(),
      avatarUrl: null,
      candidateProfile: isCandidate
        ? {
            headline: '',
            address: '',
            bio: '',
            yearsOfExperience: 0,
            skills: [],
            experiences: [],
            educations: [],
            cvUrl: null,
          }
        : null,
      companyProfile: isCandidate
        ? null
        : {
            name: payload.companyName?.trim() || 'Công ty chưa cập nhật',
            logoUrl: null,
            industry: '',
            companySize: '',
            address: '',
            website: '',
            description: '',
          },
      accountStatus: 'active',
      lockedAt: null,
      lockedBy: null,
      lockReason: null,
      createdAt: now,
      updatedAt: now,
    }

    const user = await apiClient.post<User>('/users', newUser)
    return sanitizeUser(user)
  },

  async getSessionUser(id: string): Promise<AuthUser> {
    const user = await apiClient.get<User>(`/users/${encodeURIComponent(id)}`)
    return sanitizeUser(user)
  },
}
