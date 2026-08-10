import type { Job, ModerationStatus } from '../types/job'
import { isJobExpired } from './isJobExpired'

const moderationStatuses: ModerationStatus[] = [
  'unsubmitted',
  'pending',
  'approved',
  'rejected',
  'hidden',
]

/** Dữ liệu cũ chưa migration được xem là đã duyệt để không làm mất Job hiện có. */
export function getJobModerationStatus(job: Job): ModerationStatus {
  const status = job.moderationStatus as ModerationStatus | null | undefined
  if (status === undefined || status === null) return 'approved'
  return moderationStatuses.includes(status) ? status : 'hidden'
}

export function isApprovedJob(job: Job): boolean {
  return getJobModerationStatus(job) === 'approved'
}

export function isPublicJob(job: Job): boolean {
  return job.status === 'open' && isApprovedJob(job) && !isJobExpired(job.deadline)
}
