import type { Application } from '../types/application'
import type { Bookmark } from '../types/bookmark'
import type { Job, JobFilters, JobPayload } from '../types/job'
import type { User } from '../types/user'
import { generateId } from '../utils/generateId'
import { getJobModerationStatus, isPublicJob } from '../utils/jobModeration'
import { apiClient } from './apiClient'
import { notificationService } from './notificationService'

const employerEditableKeys = [
  'title',
  'category',
  'location',
  'employmentType',
  'workplaceType',
  'salary',
  'description',
  'requirements',
  'benefits',
  'skills',
  'deadline',
  'status',
] as const

const moderationSensitiveKeys = employerEditableKeys.filter((key) => key !== 'status')

function pickEmployerChanges(payload: Partial<Job>): Partial<Job> {
  return Object.fromEntries(
    employerEditableKeys
      .filter((key) => payload[key] !== undefined)
      .map((key) => [key, payload[key]]),
  ) as Partial<Job>
}

function hasSensitiveChanges(job: Job, payload: Partial<Job>): boolean {
  return moderationSensitiveKeys.some(
    (key) => payload[key] !== undefined &&
      JSON.stringify(payload[key]) !== JSON.stringify(job[key]),
  )
}

function moderationChangesForEmployerUpdate(
  job: Job,
  payload: Partial<Job>,
  now: string,
): Partial<Job> {
  const currentModerationStatus = getJobModerationStatus(job)
  const nextJobStatus = payload.status ?? job.status
  const statusChanged = nextJobStatus !== job.status
  const sensitiveChanges = hasSensitiveChanges(job, payload)

  if (nextJobStatus === 'draft') {
    return {
      moderationStatus: 'unsubmitted',
      moderationReason: null,
      submittedAt: null,
      moderatedAt: null,
      moderatedBy: null,
    }
  }

  const needsReview =
    (currentModerationStatus === 'unsubmitted' && nextJobStatus === 'open') ||
    ((currentModerationStatus === 'rejected' || currentModerationStatus === 'hidden') &&
      (sensitiveChanges || statusChanged)) ||
    (currentModerationStatus === 'approved' && sensitiveChanges)

  if (needsReview) {
    return {
      moderationStatus: 'pending',
      moderationReason: null,
      submittedAt: now,
      moderatedAt: null,
      moderatedBy: null,
    }
  }

  if (currentModerationStatus === 'pending' && sensitiveChanges) {
    return { submittedAt: now }
  }

  return {}
}

function matchesFilters(job: Job, filters: JobFilters): boolean {
  const keyword = filters.keyword.trim().toLocaleLowerCase('vi')
  const matchesKeyword =
    !keyword ||
    job.title.toLocaleLowerCase('vi').includes(keyword) ||
    job.companyName.toLocaleLowerCase('vi').includes(keyword)

  return (
    matchesKeyword &&
    (!filters.category || job.category === filters.category) &&
    (!filters.location || job.location === filters.location) &&
    (!filters.employmentType || job.employmentType === filters.employmentType) &&
    (!filters.workplaceType || job.workplaceType === filters.workplaceType) &&
    (filters.minimumSalary === null || job.salary.max >= filters.minimumSalary)
  )
}

async function getOwnedJob(id: string, employerId: string): Promise<Job> {
  const job = await apiClient.get<Job>(`/jobs/${encodeURIComponent(id)}`)
  if (job.employerId !== employerId) {
    throw new Error('Bạn không có quyền thao tác tin tuyển dụng này.')
  }
  return job
}

export const jobService = {
  getAllForAdmin: () => apiClient.get<Job[]>('/jobs'),

  async getAll(filters?: JobFilters): Promise<Job[]> {
    const jobs = await apiClient.get<Job[]>('/jobs')
    const openJobs = jobs.filter(isPublicJob)
    return filters ? openJobs.filter((job) => matchesFilters(job, filters)) : openJobs
  },

  getById: (id: string) => apiClient.get<Job>(`/jobs/${id}`),

  async getByEmployer(employerId: string): Promise<Job[]> {
    const jobs = await apiClient.get<Job[]>(
      `/jobs?employerId=${encodeURIComponent(employerId)}`,
    )
    return jobs.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
  },

  async syncCompanyIdentity(
    employerId: string,
    companyName: string,
    companyLogoUrl: string | null,
  ): Promise<{ total: number; updated: number; failed: number }> {
    const normalizedCompanyName = companyName.trim()
    if (!normalizedCompanyName) throw new Error('Tên công ty không được để trống.')

    const jobs = await apiClient.get<Job[]>(
      `/jobs?employerId=${encodeURIComponent(employerId)}`,
    )
    if (jobs.some((job) => job.employerId !== employerId)) {
      throw new Error('Không thể xác minh quyền cập nhật tin tuyển dụng.')
    }

    const now = new Date().toISOString()
    const results = await Promise.allSettled(
      jobs.map((job) => apiClient.patch<Job>(`/jobs/${encodeURIComponent(job.id)}`, {
        companyName: normalizedCompanyName,
        companyLogoUrl,
        updatedAt: now,
      })),
    )
    const updated = results.filter((result) => result.status === 'fulfilled').length
    return { total: jobs.length, updated, failed: jobs.length - updated }
  },

  async create(payload: JobPayload): Promise<Job> {
    const employer = await apiClient.get<User>(
      `/users/${encodeURIComponent(payload.employerId)}`,
    )
    if (employer.role !== 'employer') {
      throw new Error('Chỉ tài khoản nhà tuyển dụng mới có thể đăng tin.')
    }
    if ((employer.accountStatus ?? 'active') === 'locked') {
      throw new Error('Tài khoản nhà tuyển dụng đã bị khóa.')
    }

    const now = new Date().toISOString()
    return apiClient.post<Job>('/jobs', {
      ...payload,
      companyName: employer.companyProfile?.name?.trim() || 'Công ty chưa cập nhật',
      companyLogoUrl: employer.companyProfile?.logoUrl ?? null,
      id: generateId('job'),
      moderationStatus: payload.status === 'open' ? 'pending' : 'unsubmitted',
      moderationReason: null,
      submittedAt: payload.status === 'open' ? now : null,
      moderatedAt: null,
      moderatedBy: null,
      createdAt: now,
      updatedAt: now,
    })
  },

  async updateOwned(id: string, employerId: string, payload: Partial<Job>): Promise<Job> {
    const job = await getOwnedJob(id, employerId)
    const safePayload = pickEmployerChanges(payload)
    const now = new Date().toISOString()
    return apiClient.patch<Job>(`/jobs/${encodeURIComponent(id)}`, {
      ...safePayload,
      ...moderationChangesForEmployerUpdate(job, safePayload, now),
      updatedAt: now,
    })
  },

  async removeOwned(id: string, employerId: string): Promise<void> {
    await getOwnedJob(id, employerId)
    const [applications, bookmarks] = await Promise.all([
      apiClient.get<Application[]>(`/applications?jobId=${encodeURIComponent(id)}`),
      apiClient.get<Bookmark[]>(`/bookmarks?jobId=${encodeURIComponent(id)}`),
    ])

    if (applications.length > 0) {
      throw new Error('Không thể xóa tin đã có hồ sơ ứng tuyển. Hãy đóng tin để giữ lịch sử ứng viên.')
    }

    await notificationService.removeByJob(id, employerId)
    await Promise.all(bookmarks.map((bookmark) => apiClient.delete(`/bookmarks/${bookmark.id}`)))
    await apiClient.delete(`/jobs/${id}`)
  },
}
