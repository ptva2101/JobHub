import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { Pagination } from '../../components/common/Pagination'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { notificationService } from '../../services/notificationService'
import type { Notification } from '../../types/notification'
import { formatDate } from '../../utils/formatDate'

const NOTIFICATIONS_PER_PAGE = 10

export function CandidateNotificationsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [updatingId, setUpdatingId] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!user) return

    notificationService
      .getByRecipient(user.id)
      .then((data) => {
        if (!active) return
        setNotifications(data)
        setCurrentPage(1)
        setError('')
      })
      .catch(() => {
        if (active) setError('Không thể tải danh sách thông báo. Hãy kiểm tra mock API.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.readAt === null).length,
    [notifications],
  )
  const totalPages = Math.max(
    1,
    Math.ceil(notifications.length / NOTIFICATIONS_PER_PAGE),
  )
  const paginatedNotifications = notifications.slice(
    (currentPage - 1) * NOTIFICATIONS_PER_PAGE,
    currentPage * NOTIFICATIONS_PER_PAGE,
  )

  const markOneAsRead = async (notification: Notification, announce = true) => {
    if (!user || notification.readAt !== null || updatingId || markingAll) return
    setUpdatingId(notification.id)
    try {
      const updatedNotification = await notificationService.markReadOwned(
        notification.id,
        user.id,
      )
      setNotifications((current) =>
        current.map((item) =>
          item.id === updatedNotification.id ? updatedNotification : item,
        ),
      )
      if (announce) showToast('Đã đánh dấu thông báo là đã đọc.', 'success')
    } catch (actionError) {
      showToast(
        actionError instanceof Error
          ? actionError.message
          : 'Không thể cập nhật thông báo.',
        'error',
      )
    } finally {
      setUpdatingId('')
    }
  }

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    try {
      const updatedNotifications = await notificationService.markAllReadOwned(user.id)
      setNotifications(updatedNotifications)
      showToast('Đã đánh dấu tất cả thông báo là đã đọc.', 'success')
    } catch (actionError) {
      showToast(
        actionError instanceof Error
          ? actionError.message
          : 'Không thể cập nhật tất cả thông báo.',
        'error',
      )
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold text-emerald-600">CẬP NHẬT VIỆC LÀM</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Thông báo của tôi</h1>
          <p className="mt-2 text-slate-500">
            Nhận tin tuyển dụng mới từ những công ty bạn đang quan tâm.
          </p>
        </div>
        {!loading && !error && notifications.length > 0 && (
          <button
            className="w-fit rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={unreadCount === 0 || markingAll || Boolean(updatingId)}
            onClick={() => void markAllAsRead()}
            type="button"
          >
            {markingAll ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
          </button>
        )}
      </div>

      {!loading && !error && notifications.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white">
            {notifications.length} thông báo
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 font-bold text-emerald-800">
            {unreadCount} chưa đọc
          </span>
        </div>
      )}

      <div className="mt-7">
        {loading ? (
          <Loading label="Đang tải thông báo..." />
        ) : error ? (
          <p className="rounded-xl bg-red-50 p-4 font-semibold text-red-700" role="alert">
            {error}
          </p>
        ) : notifications.length === 0 ? (
          <EmptyState
            description="Khi công ty bạn quan tâm đăng việc làm mới, thông báo sẽ xuất hiện tại đây."
            title="Bạn chưa có thông báo"
          />
        ) : (
          <>
            <div className="space-y-4">
              {paginatedNotifications.map((notification) => {
                const unread = notification.readAt === null
                return (
                  <article
                    className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
                      unread
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-slate-200 bg-white'
                    }`}
                    key={notification.id}
                  >
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 gap-4">
                        <div
                          aria-hidden="true"
                          className={`grid size-11 shrink-0 place-items-center rounded-full text-lg ${
                            unread
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          ✦
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-black text-slate-950">{notification.title}</h2>
                            {unread && (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                                Mới
                              </span>
                            )}
                          </div>
                          <p className="mt-2 leading-6 text-slate-600">{notification.message}</p>
                          <time
                            className="mt-2 block text-xs text-slate-400"
                            dateTime={notification.createdAt}
                          >
                            {formatDate(notification.createdAt)}
                          </time>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {unread && (
                          <button
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            disabled={Boolean(updatingId) || markingAll}
                            onClick={() => void markOneAsRead(notification)}
                            type="button"
                          >
                            {updatingId === notification.id ? 'Đang cập nhật...' : 'Đã đọc'}
                          </button>
                        )}
                        <Link
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                          onClick={() => void markOneAsRead(notification, false)}
                          state={{ from: '/candidate/notifications' }}
                          to={`/jobs/${notification.jobId}`}
                        >
                          Xem việc làm →
                        </Link>
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
    </div>
  )
}
