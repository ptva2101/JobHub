import type {
  CreateReviewPayload,
  Review,
  ReviewRating,
  UpdateReviewPayload,
} from '../types/review'
import type { User } from '../types/user'
import { generateId } from '../utils/generateId'
import { apiClient } from './apiClient'
import { applicationService } from './applicationService'

function validateRating(rating: number): asserts rating is ReviewRating {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Điểm đánh giá phải là số nguyên từ 1 đến 5.')
  }
}

function normalizeText(title: string, content: string) {
  const normalizedTitle = title.trim()
  const normalizedContent = content.trim()

  if (!normalizedTitle) throw new Error('Tiêu đề đánh giá không được để trống.')
  if (!normalizedContent) throw new Error('Nội dung đánh giá không được để trống.')

  if (normalizedTitle.length < 3 || normalizedTitle.length > 100) {
    throw new Error('Tiêu đề đánh giá phải có từ 3 đến 100 ký tự.')
  }

  if (normalizedContent.length < 10 || normalizedContent.length > 1000) {
    throw new Error('Nội dung đánh giá phải có từ 10 đến 1000 ký tự.')
  }

  return {
    title: normalizedTitle,
    content: normalizedContent,
  }
}

async function getOwnedReview(
  id: string,
  candidateId: string,
): Promise<Review> {
  const review = await apiClient.get<Review>(
    `/reviews/${encodeURIComponent(id)}`,
  )

  if (review.candidateId !== candidateId) {
    throw new Error(
      'Bạn không có quyền chỉnh sửa hoặc xóa đánh giá này.',
    )
  }

  return review
}

async function validateParticipants(
  candidateId: string,
  employerId: string,
) {
  const [candidate, employer] = await Promise.all([
    apiClient.get<User>(
      `/users/${encodeURIComponent(candidateId)}`,
    ),
    apiClient.get<User>(
      `/users/${encodeURIComponent(employerId)}`,
    ),
  ])

  if (candidate.role !== 'candidate') {
    throw new Error(
      'Chỉ ứng viên mới có thể gửi đánh giá.',
    )
  }

  if (
    employer.role !== 'employer' ||
    !employer.companyProfile
  ) {
    throw new Error(
      'Công ty được đánh giá không hợp lệ.',
    )
  }
}

export const reviewService = {
  getAll: () =>
    apiClient.get<Review[]>('/reviews'),

  getByEmployer: (employerId: string) =>
    apiClient.get<Review[]>(
      `/reviews?employerId=${encodeURIComponent(employerId)}`,
    ),

  getByCandidate: (candidateId: string) =>
    apiClient.get<Review[]>(
      `/reviews?candidateId=${encodeURIComponent(candidateId)}`,
    ),

  getByCandidateAndEmployer: (
    candidateId: string,
    employerId: string,
  ) =>
    apiClient.get<Review[]>(
      `/reviews?candidateId=${encodeURIComponent(candidateId)}&employerId=${encodeURIComponent(employerId)}`,
    ),

  async create(
    payload: CreateReviewPayload,
  ): Promise<Review> {
    if (!payload.candidateId.trim()) {
      throw new Error(
        'Không xác định được ứng viên đánh giá.',
      )
    }

    if (!payload.employerId.trim()) {
      throw new Error(
        'Không xác định được công ty được đánh giá.',
      )
    }

    validateRating(payload.rating)

    const normalizedText = normalizeText(
      payload.title,
      payload.content,
    )

    await validateParticipants(
      payload.candidateId,
      payload.employerId,
    )

    const hasApplied =
      await applicationService.hasAppliedToEmployer(
        payload.candidateId,
        payload.employerId,
      )

    if (!hasApplied) {
      throw new Error(
        'Bạn cần ứng tuyển ít nhất một vị trí tại công ty này trước khi có thể đánh giá.',
      )
    }

    const duplicate = await apiClient.get<Review[]>(
      `/reviews?candidateId=${encodeURIComponent(payload.candidateId)}&employerId=${encodeURIComponent(payload.employerId)}`,
    )

    if (duplicate.length > 0) {
      throw new Error(
        'Bạn đã đánh giá công ty này. Hãy sửa đánh giá hiện có thay vì tạo mới.',
      )
    }

    const now = new Date().toISOString()

    return apiClient.post<Review>(
      '/reviews',
      {
        id: generateId('review'),
        candidateId: payload.candidateId,
        employerId: payload.employerId,
        rating: payload.rating,
        ...normalizedText,
        createdAt: now,
        updatedAt: now,
      },
    )
  },

  async updateOwned(
    id: string,
    candidateId: string,
    payload: UpdateReviewPayload,
  ): Promise<Review> {
    const review = await getOwnedReview(
      id,
      candidateId,
    )

    const rating =
      payload.rating ?? review.rating

    validateRating(rating)

    const normalizedText = normalizeText(
      payload.title ?? review.title,
      payload.content ?? review.content,
    )

    return apiClient.patch<Review>(
      `/reviews/${encodeURIComponent(id)}`,
      {
        rating,
        ...normalizedText,
        updatedAt: new Date().toISOString(),
      },
    )
  },

  async removeOwned(
    id: string,
    candidateId: string,
  ): Promise<void> {
    await getOwnedReview(
      id,
      candidateId,
    )

    await apiClient.delete(
      `/reviews/${encodeURIComponent(id)}`,
    )
  },
}