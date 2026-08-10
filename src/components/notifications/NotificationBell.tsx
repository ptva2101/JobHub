import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notificationService,
} from '../../services/notificationService'

export function NotificationBell() {
  const { user } = useAuth()
  const [unreadState, setUnreadState] = useState({ recipientId: '', count: 0 })

  useEffect(() => {
    let active = true
    if (user?.role !== 'candidate') return

    const refreshUnreadCount = () => {
      notificationService
        .getUnreadCount(user.id)
        .then((count) => {
          if (active) setUnreadState({ recipientId: user.id, count })
        })
        .catch(() => {
          if (active) setUnreadState({ recipientId: user.id, count: 0 })
        })
    }

    const handleWindowFocus = () => refreshUnreadCount()
    const handleNotificationsUpdated = () => refreshUnreadCount()

    refreshUnreadCount()
    const refreshInterval = window.setInterval(refreshUnreadCount, 30_000)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsUpdated)

    return () => {
      active = false
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsUpdated)
    }
  }, [user])

  if (user?.role !== 'candidate') return null

  const unreadCount = unreadState.recipientId === user.id ? unreadState.count : 0
  const unreadLabel =
    unreadCount > 0
      ? `${unreadCount} thông báo chưa đọc`
      : 'Không có thông báo chưa đọc'

  return (
    <Link
      aria-label={`Mở thông báo. ${unreadLabel}`}
      className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      title={unreadLabel}
      to="/candidate/notifications"
    >
      <svg
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
