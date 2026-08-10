import type { AccountStatus, AuthUser, User } from '../types/user'
import { apiClient } from './apiClient'

function getAccountStatus(user: Pick<User, 'accountStatus'>): AccountStatus {
  return user.accountStatus ?? 'active'
}

function sanitizeUser(user: User): AuthUser {
  const { password, ...authUser } = user
  void password
  return authUser
}

async function getUser(id: string, missingMessage: string): Promise<User> {
  const users = await apiClient.get<User[]>(`/users?id=${encodeURIComponent(id)}`)
  const user = users[0]
  if (!user) throw new Error(missingMessage)
  return user
}

async function verifyAdminActor(actorId: string): Promise<User> {
  if (!actorId.trim()) throw new Error('Không xác định được quản trị viên thực hiện thao tác.')
  const actor = await getUser(actorId, 'Không tìm thấy tài khoản quản trị viên.')
  if (actor.role !== 'admin') {
    throw new Error('Chỉ quản trị viên mới có quyền quản lý tài khoản.')
  }
  if (getAccountStatus(actor) === 'locked') {
    throw new Error('Tài khoản quản trị viên đã bị khóa.')
  }
  return actor
}

export const adminUserService = {
  async list(actorId: string): Promise<AuthUser[]> {
    await verifyAdminActor(actorId)
    const users = await apiClient.get<User[]>('/users')
    return users.map(sanitizeUser)
  },

  async lock(
    targetUserId: string,
    actorId: string,
    reason: string,
  ): Promise<AuthUser> {
    const normalizedReason = reason.trim()
    if (!normalizedReason) throw new Error('Vui lòng nhập lý do khóa tài khoản.')
    if (normalizedReason.length > 300) {
      throw new Error('Lý do khóa tài khoản không được vượt quá 300 ký tự.')
    }

    const [actor, targetUser] = await Promise.all([
      verifyAdminActor(actorId),
      getUser(targetUserId, 'Không tìm thấy tài khoản cần khóa.'),
    ])
    if (targetUser.id === actor.id) {
      throw new Error('Bạn không thể khóa tài khoản của chính mình.')
    }
    if (targetUser.role === 'admin') {
      throw new Error('Không thể khóa tài khoản quản trị viên.')
    }
    if (getAccountStatus(targetUser) === 'locked') {
      throw new Error('Tài khoản này đã bị khóa.')
    }

    const now = new Date().toISOString()
    const updatedUser = await apiClient.patch<User>(
      `/users/${encodeURIComponent(targetUser.id)}`,
      {
        accountStatus: 'locked',
        lockedAt: now,
        lockedBy: actor.id,
        lockReason: normalizedReason,
        updatedAt: now,
      },
    )
    return sanitizeUser(updatedUser)
  },

  async unlock(targetUserId: string, actorId: string): Promise<AuthUser> {
    await verifyAdminActor(actorId)
    const targetUser = await getUser(targetUserId, 'Không tìm thấy tài khoản cần mở khóa.')
    if (getAccountStatus(targetUser) !== 'locked') {
      throw new Error('Tài khoản này đang hoạt động, không cần mở khóa.')
    }

    const updatedUser = await apiClient.patch<User>(
      `/users/${encodeURIComponent(targetUser.id)}`,
      {
        accountStatus: 'active',
        lockedAt: null,
        lockedBy: null,
        lockReason: null,
        updatedAt: new Date().toISOString(),
      },
    )
    return sanitizeUser(updatedUser)
  },
}
