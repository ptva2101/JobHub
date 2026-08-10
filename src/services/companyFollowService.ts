import type { CompanyFollow } from '../types/companyFollow'
import type { User } from '../types/user'
import { generateId } from '../utils/generateId'
import { apiClient } from './apiClient'

async function validateAccountRoles(candidateId: string, employerId: string): Promise<void> {
  const [candidateUsers, employerUsers] = await Promise.all([
    apiClient.get<User[]>(`/users?id=${encodeURIComponent(candidateId)}`),
    apiClient.get<User[]>(`/users?id=${encodeURIComponent(employerId)}`),
  ])
  const candidate = candidateUsers[0]
  const employer = employerUsers[0]

  if (!candidate) throw new Error('Không tìm thấy tài khoản ứng viên.')
  if (candidate.role !== 'candidate') {
    throw new Error('Chỉ tài khoản ứng viên mới có thể theo dõi công ty.')
  }
  if (!employer) throw new Error('Không tìm thấy tài khoản nhà tuyển dụng.')
  if (employer.role !== 'employer') {
    throw new Error('Tài khoản được theo dõi phải là nhà tuyển dụng.')
  }
}

async function getFollowById(id: string): Promise<CompanyFollow> {
  const follows = await apiClient.get<CompanyFollow[]>(
    `/companyFollows?id=${encodeURIComponent(id)}`,
  )
  const follow = follows[0]
  if (!follow) throw new Error('Không tìm thấy lượt theo dõi công ty.')
  return follow
}

export const companyFollowService = {
  getAll: () => apiClient.get<CompanyFollow[]>('/companyFollows'),

  getByCandidate: (candidateId: string) =>
    apiClient.get<CompanyFollow[]>(
      `/companyFollows?candidateId=${encodeURIComponent(candidateId)}`,
    ),

  getByEmployer: (employerId: string) =>
    apiClient.get<CompanyFollow[]>(
      `/companyFollows?employerId=${encodeURIComponent(employerId)}`,
    ),

  getByCandidateAndEmployer: (candidateId: string, employerId: string) =>
    apiClient.get<CompanyFollow[]>(
      `/companyFollows?candidateId=${encodeURIComponent(candidateId)}&employerId=${encodeURIComponent(employerId)}`,
    ),

  async create(candidateId: string, employerId: string): Promise<CompanyFollow> {
    const normalizedCandidateId = candidateId.trim()
    const normalizedEmployerId = employerId.trim()
    if (!normalizedCandidateId) throw new Error('Không xác định được ứng viên theo dõi.')
    if (!normalizedEmployerId) throw new Error('Không xác định được công ty cần theo dõi.')

    await validateAccountRoles(normalizedCandidateId, normalizedEmployerId)

    const duplicates = await apiClient.get<CompanyFollow[]>(
      `/companyFollows?candidateId=${encodeURIComponent(normalizedCandidateId)}&employerId=${encodeURIComponent(normalizedEmployerId)}`,
    )
    if (duplicates.length > 0) throw new Error('Bạn đã theo dõi công ty này.')

    return apiClient.post<CompanyFollow>('/companyFollows', {
      id: generateId('company_follow'),
      candidateId: normalizedCandidateId,
      employerId: normalizedEmployerId,
      createdAt: new Date().toISOString(),
    })
  },

  async removeOwned(id: string, candidateId: string): Promise<void> {
    const follow = await getFollowById(id)
    if (follow.candidateId !== candidateId) {
      throw new Error('Bạn không có quyền bỏ lượt theo dõi này.')
    }
    await apiClient.delete(`/companyFollows/${encodeURIComponent(id)}`)
  },
}
