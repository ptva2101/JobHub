export type ReviewRating = 1 | 2 | 3 | 4 | 5

export interface Review {
  id: string
  candidateId: string
  employerId: string
  rating: ReviewRating
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreateReviewPayload {
  candidateId: string
  employerId: string
  rating: ReviewRating
  title: string
  content: string
}

export type UpdateReviewPayload = Partial<
  Pick<Review, 'rating' | 'title' | 'content'>
>
