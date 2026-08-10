import type { ApplicationStatus } from '../types/application'

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Đã nộp', className: 'bg-amber-100 text-amber-800' },
  reviewing: { label: 'Đang xem xét', className: 'bg-blue-100 text-blue-800' },
  interviewed: { label: 'Phỏng vấn', className: 'bg-violet-100 text-violet-800' },
  accepted: { label: 'Đã nhận', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Từ chối', className: 'bg-red-100 text-red-800' },
}
