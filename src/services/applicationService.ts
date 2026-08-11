import type {
  Application,
  ApplicationNotification,
  ApplicationStatus,
} from '../types/application'
import type { Job } from '../types/job'
import type { User } from '../types/user'
import { generateId } from '../utils/generateId'
import { isPublicJob } from '../utils/jobModeration'
import { apiClient } from './apiClient'

export interface CreateApplicationPayload {
  jobId: string
  candidateId: string
  cvUrl: string
  coverLetter: string
}

async function getOwnedApplication(
  id: string,
  employerId: string,
): Promise<Application> {
  const application = await apiClient.get<Application>(
    `/applications/${id}`,
  )

  const job = await apiClient.get<Job>(
    `/jobs/${application.jobId}`,
  )

  if (job.employerId !== employerId) {
    throw new Error(
      'Bạn không có quyền quản lý hồ sơ ứng tuyển này.',
    )
  }

  return application
}

export const applicationService = {
  getAll: () =>
    apiClient.get<Application[]>('/applications'),

  getByCandidate: (candidateId: string) =>
    apiClient.get<Application[]>(
      `/applications?candidateId=${encodeURIComponent(candidateId)}`,
    ),

  getByJob: (jobId: string) =>
    apiClient.get<Application[]>(
      `/applications?jobId=${encodeURIComponent(jobId)}`,
    ),

  getByCandidateAndJob: (
    candidateId: string,
    jobId: string,
  ) =>
    apiClient.get<Application[]>(
      `/applications?candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(jobId)}`,
    ),

  async hasAppliedToEmployer(
    candidateId: string,
    employerId: string,
  ): Promise<boolean> {
    const [applications, employerJobs] = await Promise.all([
      apiClient.get<Application[]>(
        `/applications?candidateId=${encodeURIComponent(candidateId)}`,
      ),
      apiClient.get<Job[]>(
        `/jobs?employerId=${encodeURIComponent(employerId)}`,
      ),
    ])

    if (
      applications.length === 0 ||
      employerJobs.length === 0
    ) {
      return false
    }

    const employerJobIds = new Set(
      employerJobs.map((job) => job.id),
    )

    return applications.some((application) =>
      employerJobIds.has(application.jobId),
    )
  },

  async create(
    payload: CreateApplicationPayload,
  ): Promise<Application> {
    const [duplicate, job, candidate] = await Promise.all([
      apiClient.get<Application[]>(
        `/applications?jobId=${encodeURIComponent(payload.jobId)}&candidateId=${encodeURIComponent(payload.candidateId)}`,
      ),
      apiClient.get<Job>(
        `/jobs/${encodeURIComponent(payload.jobId)}`,
      ),
      apiClient.get<User>(
        `/users/${encodeURIComponent(payload.candidateId)}`,
      ),
    ])

    if (duplicate.length > 0) {
      throw new Error(
        'Bạn đã ứng tuyển công việc này.',
      )
    }

    if (candidate.role !== 'candidate') {
      throw new Error(
        'Chỉ tài khoản ứng viên mới có thể nộp hồ sơ.',
      )
    }

    if ((candidate.accountStatus ?? 'active') === 'locked') {
      throw new Error(
        'Tài khoản ứng viên đã bị khóa.',
      )
    }

    if (!isPublicJob(job)) {
      throw new Error(
        'Tin tuyển dụng chưa được duyệt, đã đóng hoặc đã hết hạn.',
      )
    }

    const now = new Date().toISOString()

    return apiClient.post<Application>('/applications', {
      ...payload,
      id: generateId('application'),
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          changedBy: payload.candidateId,
          changedAt: now,
          note: 'Ứng viên đã nộp hồ sơ',
        },
      ],
      lastNotification: null,
      appliedAt: now,
      updatedAt: now,
    })
  },

  async updateStatusOwned(
    id: string,
    status: ApplicationStatus,
    employerId: string,
    note = 'Nhà tuyển dụng đã cập nhật trạng thái hồ sơ',
  ): Promise<Application> {
    const application = await getOwnedApplication(
      id,
      employerId,
    )

    if (application.status === status) {
      return application
    }

    const now = new Date().toISOString()

    return apiClient.patch<Application>(
      `/applications/${id}`,
      {
        status,
        statusHistory: [
          ...application.statusHistory,
          {
            status,
            changedBy: employerId,
            changedAt: now,
            note,
          },
        ],
        updatedAt: now,
      },
    )
  },

  async sendNotificationOwned(
    id: string,
    employerId: string,
    channel: ApplicationNotification['channel'],
    message: string,
  ): Promise<Application> {
    if (!message.trim()) {
      throw new Error(
        'Nội dung thông báo không được để trống.',
      )
    }

    await getOwnedApplication(id, employerId)

    const now = new Date().toISOString()

    return apiClient.patch<Application>(
      `/applications/${id}`,
      {
        lastNotification: {
          channel,
          message: message.trim(),
          sentAt: now,
        },
        updatedAt: now,
      },
    )
  },
}