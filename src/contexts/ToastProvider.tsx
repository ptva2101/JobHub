import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { generateId } from '../utils/generateId'
import { ToastContext, type ToastVariant } from './toast-context'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  closing: boolean
}

interface ToastRequest {
  message: string
  variant: ToastVariant
  duration: number
}

const toastListeners = new Set<(request: ToastRequest) => void>()

const variantStyles: Record<ToastVariant, { icon: string; className: string }> = {
  success: { icon: '✓', className: 'border-emerald-800 bg-emerald-700 text-white' },
  error: { icon: '!', className: 'border-red-800 bg-red-700 text-white' },
  info: { icon: 'i', className: 'border-slate-950 bg-slate-900 text-white' },
}

function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, number>())
  const removalTimers = useRef(new Map<string, number>())
  const closingIds = useRef(new Set<string>())

  const dismissToast = useCallback((id: string) => {
    if (closingIds.current.has(id)) return
    closingIds.current.add(id)

    const autoDismissTimer = timers.current.get(id)
    if (autoDismissTimer) window.clearTimeout(autoDismissTimer)
    timers.current.delete(id)
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)),
    )

    const removalTimer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
      removalTimers.current.delete(id)
      closingIds.current.delete(id)
    }, 320)
    removalTimers.current.set(id, removalTimer)
  }, [])

  const showToast = useCallback(
    ({ message, variant, duration }: ToastRequest) => {
      const id = generateId('toast')
      setToasts((current) => [...current, { id, message, variant, closing: false }])

      // Giữ mọi thông báo đủ lâu để người dùng đọc, kể cả nơi gọi truyền thời gian ngắn hơn.
      const visibleDuration = Math.max(duration, 3000)
      const timer = window.setTimeout(() => dismissToast(id), visibleDuration)
      timers.current.set(id, timer)
    },
    [dismissToast],
  )

  useEffect(() => {
    const activeTimers = timers.current
    const activeRemovalTimers = removalTimers.current
    toastListeners.add(showToast)
    return () => {
      toastListeners.delete(showToast)
      activeTimers.forEach((timer) => window.clearTimeout(timer))
      activeRemovalTimers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [showToast])

  return (
    <div aria-live="polite" className="toast-viewport pointer-events-none fixed right-4 top-4 z-[9999] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3" role="status">
      {toasts.map((toast) => {
        const style = variantStyles[toast.variant]
        return (
          <div className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg ${style.className} ${toast.closing ? 'toast-exit' : 'toast-enter'}`} key={toast.id}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-black text-white">{style.icon}</span>
            <p className="min-w-0 flex-1 pt-0.5 text-sm font-bold leading-5 text-white">{toast.message}</p>
            <button aria-label="Đóng thông báo" className="-mr-1 -mt-1 rounded-lg p-1 text-white opacity-80 hover:bg-black/15 hover:opacity-100" onClick={() => dismissToast(toast.id)} type="button">×</button>
          </div>
        )
      })}
    </div>
  )
}

export function ToastProvider({ children }: PropsWithChildren) {
  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 3000) => {
      toastListeners.forEach((listener) => listener({ message, variant, duration }))
    },
    [],
  )
  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(<ToastViewport />, document.body)}
    </ToastContext.Provider>
  )
}
