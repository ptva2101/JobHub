import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useToast } from '../hooks/useToast'
import { ApiError } from '../services/apiClient'
import { authService } from '../services/authService'
import type { AuthSession, LoginCredentials, RegisterPayload } from '../types/auth'
import type { AuthUser, User } from '../types/user'
import { userService } from '../services/userService'
import { AuthContext } from './auth-context'

const SESSION_KEY = 'jobhub_session'

function writeStoredUser(user: AuthUser) {
  const session: AuthSession = {
    user,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function readStoredUser(): AuthUser | null {
  try {
    const rawSession = localStorage.getItem(SESSION_KEY)
    if (!rawSession) return null
    const storedUser = (JSON.parse(rawSession) as AuthSession).user
    if (storedUser.accountStatus === 'locked') {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return { ...storedUser, accountStatus: storedUser.accountStatus ?? 'active' }
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { showToast } = useToast()
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)

  const saveSession = useCallback((authenticatedUser: AuthUser) => {
    writeStoredUser(authenticatedUser)
    setUser(authenticatedUser)
  }, [])

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const userId = user?.id
  useEffect(() => {
    let active = true
    if (!userId) return

    const enforceAccountStatus = async () => {
      try {
        const latestUser = await authService.getSessionUser(userId)
        if (!active) return

        if (latestUser.accountStatus === 'locked') {
          clearSession()
          showToast(
            'Phiên đăng nhập đã kết thúc vì tài khoản của bạn bị khóa.',
            'error',
          )
          return
        }

        writeStoredUser(latestUser)
        setUser((currentUser) => {
          if (currentUser?.id !== userId) return currentUser
          return JSON.stringify(currentUser) === JSON.stringify(latestUser)
            ? currentUser
            : latestUser
        })
      } catch (sessionError) {
        if (active && sessionError instanceof ApiError && sessionError.status === 404) {
          clearSession()
        }
      }
    }

    void enforceAccountStatus()
    window.addEventListener('focus', enforceAccountStatus)

    return () => {
      active = false
      window.removeEventListener('focus', enforceAccountStatus)
    }
  }, [clearSession, showToast, userId])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      async login(credentials: LoginCredentials) {
        const authenticatedUser = await authService.login(credentials)
        saveSession(authenticatedUser)
        return authenticatedUser
      },
      async register(payload: RegisterPayload) {
        const authenticatedUser = await authService.register(payload)
        saveSession(authenticatedUser)
        return authenticatedUser
      },
      async updateCurrentUser(payload: Partial<User>) {
        if (!user) throw new Error('Bạn cần đăng nhập để cập nhật hồ sơ.')

        const updatedUser = await userService.update(user.id, payload)
        const { password, ...authenticatedUser } = updatedUser
        void password
        if (authenticatedUser.accountStatus === 'locked') {
          clearSession()
          throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.')
        }
        saveSession(authenticatedUser)
        return authenticatedUser
      },
      logout: clearSession,
    }),
    [clearSession, saveSession, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
