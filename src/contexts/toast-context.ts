import { createContext } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined)
