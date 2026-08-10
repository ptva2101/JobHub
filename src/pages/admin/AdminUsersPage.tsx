import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { Pagination } from '../../components/common/Pagination'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { adminUserService } from '../../services/adminUserService'
import type { AccountStatus, AuthUser, UserRole } from '../../types/user'
import { formatDate } from '../../utils/formatDate'

const PAGE_SIZE = 12

const roleMeta: Record<UserRole, { label: string; className: string }> = {
  admin: { label: 'Quản trị viên', className: 'bg-violet-100 text-violet-700' },
  employer: { label: 'Nhà tuyển dụng', className: 'bg-blue-100 text-blue-700' },
  candidate: { label: 'Ứng viên', className: 'bg-emerald-100 text-emerald-700' },
}

function getAccountStatus(user: AuthUser): AccountStatus {
  return user.accountStatus ?? 'active'
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi'))
    .join('')
}

export function AdminUsersPage() {
  const { user: actor } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [lockTarget, setLockTarget] = useState<AuthUser | null>(null)
  const [lockReason, setLockReason] = useState('')
  const [modalError, setModalError] = useState('')
  const [processingId, setProcessingId] = useState('')
  const processingRef = useRef(false)
  const actorId = actor?.id

  useEffect(() => {
    let active = true

    const loadUsers = async () => {
      if (!actorId) {
        if (active) {
          setError('Bạn cần đăng nhập bằng tài khoản quản trị viên.')
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError('')
      try {
        const data = await adminUserService.list(actorId)
        if (!active) return
        setUsers(
          data.sort((first, second) =>
            second.createdAt.localeCompare(first.createdAt),
          ),
        )
        setCurrentPage(1)
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Không thể tải danh sách tài khoản.',
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadUsers()
    return () => {
      active = false
    }
  }, [actorId, reloadToken])

  useEffect(() => {
    if (!lockTarget) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processingId) setLockTarget(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lockTarget, processingId])

  const filteredUsers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    return users.filter((user) => {
      const companyName = user.companyProfile?.name ?? ''
      const matchesKeyword =
        !normalizedKeyword ||
        [user.fullName, user.email, user.phone, companyName].some((value) =>
          value.toLocaleLowerCase('vi').includes(normalizedKeyword),
        )

      return (
        matchesKeyword &&
        (roleFilter === 'all' || user.role === roleFilter) &&
        (statusFilter === 'all' || getAccountStatus(user) === statusFilter)
      )
    })
  }, [keyword, roleFilter, statusFilter, users])

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => getAccountStatus(user) === 'active').length,
      locked: users.filter((user) => getAccountStatus(user) === 'locked').length,
      employers: users.filter((user) => user.role === 'employer').length,
    }),
    [users],
  )

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const firstResult =
    filteredUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastResult = Math.min(currentPage * PAGE_SIZE, filteredUsers.length)

  const updateUser = (updatedUser: AuthUser) => {
    setUsers((current) =>
      current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    )
    setCurrentPage(1)
  }

  const openLockModal = (target: AuthUser) => {
    if (processingId) return
    setLockTarget(target)
    setLockReason('')
    setModalError('')
  }

  const closeLockModal = () => {
    if (processingId) return
    setLockTarget(null)
    setLockReason('')
    setModalError('')
  }

  const lockUser = async (event: FormEvent) => {
    event.preventDefault()
    if (!actorId || !lockTarget || processingRef.current) return
    if (!lockReason.trim()) {
      setModalError('Vui lòng nhập lý do khóa tài khoản.')
      return
    }

    const target = lockTarget
    processingRef.current = true
    setProcessingId(target.id)
    setModalError('')
    try {
      const updatedUser = await adminUserService.lock(
        target.id,
        actorId,
        lockReason,
      )
      updateUser(updatedUser)
      setLockTarget(null)
      setLockReason('')
      showToast(`Đã khóa tài khoản ${target.fullName}.`, 'success')
    } catch (actionError) {
      setModalError(
        actionError instanceof Error
          ? actionError.message
          : 'Không thể khóa tài khoản.',
      )
    } finally {
      processingRef.current = false
      setProcessingId('')
    }
  }

  const unlockUser = async (target: AuthUser) => {
    if (!actorId || processingRef.current) return
    if (!window.confirm(`Mở khóa tài khoản “${target.fullName}”?`)) return

    processingRef.current = true
    setProcessingId(target.id)
    try {
      const updatedUser = await adminUserService.unlock(target.id, actorId)
      updateUser(updatedUser)
      showToast(`Đã mở khóa tài khoản ${target.fullName}.`, 'success')
    } catch (actionError) {
      showToast(
        actionError instanceof Error
          ? actionError.message
          : 'Không thể mở khóa tài khoản.',
        'error',
      )
    } finally {
      processingRef.current = false
      setProcessingId('')
    }
  }

  const resetFilters = () => {
    setKeyword('')
    setRoleFilter('all')
    setStatusFilter('all')
    setCurrentPage(1)
  }

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">QUẢN TRỊ HỆ THỐNG</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Quản lý tài khoản</h1>
      <p className="mt-2 text-slate-500">
        Tìm kiếm, theo dõi trạng thái và kiểm soát quyền truy cập tài khoản JobHub.
      </p>

      {!loading && !error && (
        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Thống kê tài khoản">
          {[
            { label: 'Tổng tài khoản', value: stats.total, color: 'text-slate-950' },
            { label: 'Đang hoạt động', value: stats.active, color: 'text-emerald-600' },
            { label: 'Đã bị khóa', value: stats.locked, color: 'text-red-600' },
            { label: 'Nhà tuyển dụng', value: stats.employers, color: 'text-blue-600' },
          ].map((item) => (
            <article className="rounded-2xl bg-white p-5 shadow-sm" key={item.label}>
              <p className={`text-3xl font-black ${item.color}`}>
                {item.value.toLocaleString('vi-VN')}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {item.label}
              </p>
            </article>
          ))}
        </section>
      )}

      {!loading && !error && (
        <section className="mt-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]" aria-label="Bộ lọc tài khoản">
          <label>
            <span className="sr-only">Tìm tài khoản</span>
            <input
              className="field"
              onChange={(event) => {
                setKeyword(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Tên, email, số điện thoại hoặc công ty..."
              type="search"
              value={keyword}
            />
          </label>
          <select
            aria-label="Lọc theo vai trò"
            className="field"
            onChange={(event) => {
              setRoleFilter(event.target.value as UserRole | 'all')
              setCurrentPage(1)
            }}
            value={roleFilter}
          >
            <option value="all">Mọi vai trò</option>
            <option value="admin">Quản trị viên</option>
            <option value="employer">Nhà tuyển dụng</option>
            <option value="candidate">Ứng viên</option>
          </select>
          <select
            aria-label="Lọc theo trạng thái"
            className="field"
            onChange={(event) => {
              setStatusFilter(event.target.value as AccountStatus | 'all')
              setCurrentPage(1)
            }}
            value={statusFilter}
          >
            <option value="all">Mọi trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="locked">Đã bị khóa</option>
          </select>
          <button
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
            onClick={resetFilters}
            type="button"
          >
            Xóa bộ lọc
          </button>
        </section>
      )}

      <div className="mt-6">
        {loading ? (
          <Loading label="Đang tải danh sách tài khoản..." />
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="font-semibold text-red-700" role="alert">{error}</p>
            <button
              className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              onClick={() => setReloadToken((current) => current + 1)}
              type="button"
            >
              Thử tải lại
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            description="Hãy thay đổi từ khóa hoặc bộ lọc để xem tài khoản khác."
            title="Không tìm thấy tài khoản phù hợp"
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Đang hiển thị {firstResult}–{lastResult} trong {filteredUsers.length} tài khoản
            </p>
            <div className="space-y-4">
              {paginatedUsers.map((account) => {
                const status = getAccountStatus(account)
                const role = roleMeta[account.role]
                const isProtected = account.role === 'admin'
                const isSelf = account.id === actorId
                const processing = processingId === account.id

                return (
                  <article
                    className={`rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${
                      status === 'locked' ? 'border-red-200' : 'border-slate-100'
                    }`}
                    key={account.id}
                  >
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 gap-4">
                        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-black text-white">
                          {getInitials(account.fullName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-black text-slate-950">{account.fullName}</h2>
                            {isSelf && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                Bạn
                              </span>
                            )}
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${role.className}`}>
                              {role.label}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              status === 'locked'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {status === 'locked' ? 'Đã bị khóa' : 'Đang hoạt động'}
                            </span>
                          </div>
                          <p className="mt-1 break-all text-sm font-semibold text-slate-600">
                            {account.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {account.phone || 'Chưa có số điện thoại'} · Tạo ngày {formatDate(account.createdAt)}
                          </p>
                          {account.companyProfile?.name && (
                            <p className="mt-2 text-sm font-semibold text-blue-700">
                              {account.companyProfile.name}
                            </p>
                          )}
                          {status === 'locked' && (
                            <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                              <p><strong>Lý do:</strong> {account.lockReason || 'Không có lý do'}</p>
                              {account.lockedAt && <p>Khóa ngày {formatDate(account.lockedAt)}</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isProtected ? (
                          <span className="inline-block rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-500">
                            Tài khoản được bảo vệ
                          </span>
                        ) : status === 'locked' ? (
                          <button
                            className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={Boolean(processingId)}
                            onClick={() => void unlockUser(account)}
                            type="button"
                          >
                            {processing ? 'Đang mở khóa...' : 'Mở khóa'}
                          </button>
                        ) : (
                          <button
                            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={Boolean(processingId)}
                            onClick={() => openLockModal(account)}
                            type="button"
                          >
                            Khóa tài khoản
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            <Pagination
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              totalPages={totalPages}
            />
          </>
        )}
      </div>

      {lockTarget && (
        <div
          aria-labelledby="lock-account-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeLockModal()
          }}
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-red-600">KIỂM SOÁT TÀI KHOẢN</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950" id="lock-account-title">
                  Khóa {lockTarget.fullName}?
                </h2>
              </div>
              <button
                aria-label="Đóng hộp thoại"
                className="rounded-lg p-2 text-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                disabled={Boolean(processingId)}
                onClick={closeLockModal}
                type="button"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Người dùng sẽ không thể đăng nhập và phiên đang mở sẽ kết thúc khi hệ thống kiểm tra lại trạng thái.
            </p>
            <form className="mt-6" onSubmit={(event) => void lockUser(event)}>
              <label className="block" htmlFor="lock-reason">
                <span className="label">Lý do khóa</span>
                <textarea
                  autoFocus
                  className="field mt-2 min-h-32 resize-y"
                  id="lock-reason"
                  maxLength={300}
                  onChange={(event) => {
                    setLockReason(event.target.value)
                    setModalError('')
                  }}
                  placeholder="Ví dụ: Tài khoản vi phạm chính sách sử dụng..."
                  required
                  value={lockReason}
                />
              </label>
              <p className="mt-2 text-right text-xs text-slate-400">
                {lockReason.length}/300 ký tự
              </p>
              {modalError && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
                  {modalError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={Boolean(processingId)}
                  onClick={closeLockModal}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(processingId)}
                  type="submit"
                >
                  {processingId ? 'Đang khóa...' : 'Xác nhận khóa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
