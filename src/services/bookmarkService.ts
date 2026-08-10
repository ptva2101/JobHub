import type { Bookmark } from '../types/bookmark'
import type { Job } from '../types/job'
import type { User } from '../types/user'
import { generateId } from '../utils/generateId'
import { isPublicJob } from '../utils/jobModeration'
import { apiClient } from './apiClient'

export const bookmarkService = {
  getByCandidate: (candidateId: string) =>
    apiClient.get<Bookmark[]>(`/bookmarks?candidateId=${encodeURIComponent(candidateId)}`),

  getByCandidateAndJob: (candidateId: string, jobId: string) =>
    apiClient.get<Bookmark[]>(
      `/bookmarks?candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(jobId)}`,
    ),

  async create(candidateId: string, jobId: string): Promise<Bookmark> {
    const [bookmarks, candidate, job] = await Promise.all([
      apiClient.get<Bookmark[]>(
        `/bookmarks?candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(jobId)}`,
      ),
      apiClient.get<User>(`/users/${encodeURIComponent(candidateId)}`),
      apiClient.get<Job>(`/jobs/${encodeURIComponent(jobId)}`),
    ])
    if (bookmarks.length > 0) return bookmarks[0]
    if (candidate.role !== 'candidate' || (candidate.accountStatus ?? 'active') === 'locked') {
      throw new Error('Tài khoản ứng viên không thể lưu việc làm.')
    }
    if (!isPublicJob(job)) {
      throw new Error('Tin tuyển dụng chưa được duyệt, đã đóng hoặc đã hết hạn.')
    }

    return apiClient.post<Bookmark>('/bookmarks', {
      id: generateId('bookmark'),
      candidateId,
      jobId,
      createdAt: new Date().toISOString(),
    })
  },

  remove: (id: string) => apiClient.delete(`/bookmarks/${id}`),
}
