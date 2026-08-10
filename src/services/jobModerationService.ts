import type { Job, JobStatus, ModerationStatus } from '../types/job'
import type { User } from '../types/user'
import { isJobExpired } from '../utils/isJobExpired'
import { getJobModerationStatus } from '../utils/jobModeration'
import { apiClient } from './apiClient'
import { notificationService } from './notificationService'

export interface JobApprovalResult {
  job: Job
  notificationsCreated: number
  notificationWarning: string | null
}

const moderationStatuses: ModerationStatus[] = [
  'unsubmitted',
  'pending',
  'approved',
  'rejected',
  'hidden',
]
const jobStatuses: JobStatus[] = ['draft', 'open', 'closed']
const moderationSortOrder: Record<ModerationStatus, number> = {
  pending: 0,
  rejected: 1,
  hidden: 2,
  unsubmitted: 3,
  approved: 4,
}

function isValidIsoDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function ensureAdmin(users: User[], actorId: string): User {
  const normalizedActorId = actorId.trim()
  if (!normalizedActorId) throw new Error('Không xác định được quản trị viên thực hiện thao tác.')
  const actor = users.find((user) => user.id === normalizedActorId)
  if (!actor || actor.role !== 'admin') {
    throw new Error('Chỉ quản trị viên mới có quyền kiểm duyệt tin tuyển dụng.')
  }
  if (actor.accountStatus === 'locked') {
    throw new Error('Tài khoản quản trị viên đã bị khóa.')
  }
  return actor
}

function validateJobData(job: Job, users: User[]): void {
  if (!job.id?.trim() || !job.employerId?.trim() || !job.title?.trim()) {
    throw new Error('Tin tuyển dụng thiếu ID, nhà tuyển dụng hoặc tiêu đề.')
  }
  if (!jobStatuses.includes(job.status)) {
    throw new Error(`Tin “${job.title}” có trạng thái đăng tuyển không hợp lệ.`)
  }
  const employer = users.find((user) => user.id === job.employerId)
  if (!employer || employer.role !== 'employer') {
    throw new Error(`Tin “${job.title}” không thuộc một nhà tuyển dụng hợp lệ.`)
  }

  const rawStatus = job.moderationStatus as ModerationStatus | null | undefined
  if (rawStatus === undefined || rawStatus === null) return
  if (!moderationStatuses.includes(rawStatus)) {
    throw new Error(`Tin “${job.title}” có trạng thái kiểm duyệt không hợp lệ.`)
  }
  const status = getJobModerationStatus(job)
  const reason = job.moderationReason?.trim() ?? ''

  if (status === 'unsubmitted') {
    if (
      job.submittedAt !== null ||
      job.moderatedAt !== null ||
      job.moderatedBy !== null ||
      job.moderationReason !== null
    ) {
      throw new Error(`Tin “${job.title}” có dữ liệu gửi duyệt không nhất quán.`)
    }
    return
  }

  if (!isValidIsoDate(job.submittedAt)) {
    throw new Error(`Tin “${job.title}” thiếu thời điểm gửi duyệt hợp lệ.`)
  }
  if (job.submittedAt < job.createdAt || job.submittedAt > job.updatedAt) {
    throw new Error(`Tin “${job.title}” có thời điểm gửi duyệt không hợp lý.`)
  }
  if (status === 'pending') {
    if (job.moderatedAt !== null || job.moderatedBy !== null || reason) {
      throw new Error(`Tin “${job.title}” có dữ liệu chờ duyệt không nhất quán.`)
    }
    return
  }

  const moderator = users.find((user) => user.id === job.moderatedBy)
  if (
    !isValidIsoDate(job.moderatedAt) ||
    job.moderatedAt < job.submittedAt ||
    job.moderatedAt > job.updatedAt ||
    moderator?.role !== 'admin'
  ) {
    throw new Error(`Tin “${job.title}” thiếu thông tin người kiểm duyệt.`)
  }
  if ((status === 'rejected' || status === 'hidden') && !reason) {
    throw new Error(`Tin “${job.title}” thiếu lý do kiểm duyệt.`)
  }
  if (status === 'approved' && reason) {
    throw new Error(`Tin “${job.title}” đã duyệt nhưng vẫn còn lý do từ chối/ẩn.`)
  }
}

async function getActionContext(jobId: string, actorId: string) {
  const [users, job] = await Promise.all([
    apiClient.get<User[]>('/users'),
    apiClient.get<Job>(`/jobs/${encodeURIComponent(jobId)}`),
  ])
  const actor = ensureAdmin(users, actorId)
  validateJobData(job, users)
  return { actor, job }
}

function normalizeReason(reason: string): string {
  const normalizedReason = reason.trim()
  if (!normalizedReason) throw new Error('Vui lòng nhập lý do kiểm duyệt.')
  if (normalizedReason.length > 500) {
    throw new Error('Lý do kiểm duyệt không được vượt quá 500 ký tự.')
  }
  return normalizedReason
}

export const jobModerationService = {
  async list(actorId: string): Promise<Job[]> {
    const [users, jobs] = await Promise.all([
      apiClient.get<User[]>('/users'),
      apiClient.get<Job[]>('/jobs'),
    ])
    ensureAdmin(users, actorId)
    jobs.forEach((job) => validateJobData(job, users))

    return [...jobs].sort((first, second) => {
      const statusDifference =
        moderationSortOrder[getJobModerationStatus(first)] -
        moderationSortOrder[getJobModerationStatus(second)]
      return statusDifference || second.updatedAt.localeCompare(first.updatedAt)
    })
  },

  async approve(jobId: string, actorId: string): Promise<JobApprovalResult> {
    const { actor, job } = await getActionContext(jobId, actorId)
    const currentStatus = getJobModerationStatus(job)
    if (!(['pending', 'rejected', 'hidden'] as ModerationStatus[]).includes(currentStatus)) {
      throw new Error(
        currentStatus === 'unsubmitted'
          ? 'Tin chưa được nhà tuyển dụng gửi duyệt.'
          : 'Tin tuyển dụng này đã được duyệt.',
      )
    }

    const now = new Date().toISOString()
    const approvedJob = await apiClient.patch<Job>(`/jobs/${encodeURIComponent(job.id)}`, {
      moderationStatus: 'approved',
      moderationReason: null,
      submittedAt: job.submittedAt ?? job.createdAt,
      moderatedAt: now,
      moderatedBy: actor.id,
      updatedAt: now,
    })

    let notificationsCreated = 0
    let notificationWarning: string | null = null
    if (approvedJob.status === 'open' && !isJobExpired(approvedJob.deadline)) {
      try {
        const notifications = await notificationService.notifyFollowersForJob(approvedJob)
        notificationsCreated = notifications.length
      } catch (notificationError) {
        notificationWarning = notificationError instanceof Error
          ? notificationError.message
          : 'Không thể gửi thông báo việc làm mới tới người theo dõi.'
      }
    }

    return { job: approvedJob, notificationsCreated, notificationWarning }
  },

  async reject(jobId: string, actorId: string, reason: string): Promise<Job> {
    const { actor, job } = await getActionContext(jobId, actorId)
    const normalizedReason = normalizeReason(reason)
    if (getJobModerationStatus(job) !== 'pending') {
      throw new Error('Chỉ tin đang chờ duyệt mới có thể bị từ chối.')
    }

    const now = new Date().toISOString()
    return apiClient.patch<Job>(`/jobs/${encodeURIComponent(job.id)}`, {
      moderationStatus: 'rejected',
      moderationReason: normalizedReason,
      moderatedAt: now,
      moderatedBy: actor.id,
      updatedAt: now,
    })
  },

  async hide(jobId: string, actorId: string, reason: string): Promise<Job> {
    const { actor, job } = await getActionContext(jobId, actorId)
    const normalizedReason = normalizeReason(reason)
    if (getJobModerationStatus(job) !== 'approved') {
      throw new Error('Chỉ tin đã được duyệt mới có thể bị ẩn.')
    }

    const now = new Date().toISOString()
    return apiClient.patch<Job>(`/jobs/${encodeURIComponent(job.id)}`, {
      moderationStatus: 'hidden',
      moderationReason: normalizedReason,
      submittedAt: job.submittedAt ?? job.createdAt,
      moderatedAt: now,
      moderatedBy: actor.id,
      updatedAt: now,
    })
  },
}
