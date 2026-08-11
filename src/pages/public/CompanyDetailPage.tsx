import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { Pagination } from '../../components/common/Pagination'
import { StarRating } from '../../components/reviews/StarRating'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { applicationService } from '../../services/applicationService'
import { companyFollowService } from '../../services/companyFollowService'
import { jobService } from '../../services/jobService'
import { reviewService } from '../../services/reviewService'
import { userService } from '../../services/userService'
import type { Job } from '../../types/job'
import type { CompanyFollow } from '../../types/companyFollow'
import type { Review, ReviewRating } from '../../types/review'
import type { User } from '../../types/user'
import { formatDate } from '../../utils/formatDate'
import { isPublicJob } from '../../utils/jobModeration'

const REVIEWS_PER_PAGE = 8
const ratingOptions: ReviewRating[] = [5, 4, 3, 2, 1]

function sortReviews(reviews: Review[]) {
  return [...reviews].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

export function CompanyDetailPage() {
  const { employerId = '' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [company, setCompany] = useState<User | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [companyFollows, setCompanyFollows] = useState<CompanyFollow[]>([])
  const [openJobs, setOpenJobs] = useState<Job[]>([])
  const [hasAppliedToCompany, setHasAppliedToCompany] = useState(false)
  const [candidateNames, setCandidateNames] = useState(new Map<string, string>())
  const [rating, setRating] = useState<ReviewRating | 0>(0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [togglingFollow, setTogglingFollow] = useState(false)

  useEffect(() => {
    let active = true

    const loadCompany = async () => {
      setLoading(true)
      setError('')
      try {
        const [employer, companyReviews, companyJobs, users, follows, hasApplied] = await Promise.all([
          userService.getById(employerId),
          reviewService.getByEmployer(employerId),
          jobService.getByEmployer(employerId),
          userService.getAll(),
          companyFollowService.getByEmployer(employerId),
          user?.role === 'candidate'
            ? applicationService.hasAppliedToEmployer(user.id, employerId)
            : Promise.resolve(false),
        ])

        if (employer.role !== 'employer' || !employer.companyProfile) {
          throw new Error('not-company')
        }

        if (!active) return

        const sortedReviews = sortReviews(companyReviews)
        const ownReview = user?.role === 'candidate'
          ? sortedReviews.find((review) => review.candidateId === user.id)
          : undefined

        setCompany(employer)
        setReviews(sortedReviews)
        setCompanyFollows(follows)
        setHasAppliedToCompany(hasApplied)

        setOpenJobs(
          companyJobs
            .filter(isPublicJob)
            .sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
        )

        setCandidateNames(new Map(
          users
            .filter((candidate) => candidate.role === 'candidate')
            .map((candidate) => [candidate.id, candidate.fullName]),
        ))

        setRating(ownReview?.rating ?? 0)
        setTitle(ownReview?.title ?? '')
        setContent(ownReview?.content ?? '')
        setCurrentPage(1)
      } catch {
        if (active) {
          setError('Không tìm thấy thông tin công ty hoặc không thể tải dữ liệu.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadCompany()

    return () => {
      active = false
    }
  }, [employerId, user?.id, user?.role])

  const ownReview = user?.role === 'candidate'
    ? reviews.find((review) => review.candidateId === user.id) ?? null
    : null

  const ownFollow = user?.role === 'candidate'
    ? companyFollows.find((follow) => follow.candidateId === user.id) ?? null
    : null

  const averageRating = reviews.length === 0
    ? 0
    : reviews.reduce((total, review) => total + review.rating, 0) / reviews.length

  const ratingCounts = useMemo(
    () => Object.fromEntries(
      ratingOptions.map((value) => [
        value,
        reviews.filter((review) => review.rating === value).length,
      ]),
    ) as Record<ReviewRating, number>,
    [reviews],
  )

  const totalPages = Math.max(
    1,
    Math.ceil(reviews.length / REVIEWS_PER_PAGE),
  )

  const paginatedReviews = reviews.slice(
    (currentPage - 1) * REVIEWS_PER_PAGE,
    currentPage * REVIEWS_PER_PAGE,
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!company || user?.role !== 'candidate') return

    if (rating === 0) {
      setFormError('Vui lòng chọn số sao đánh giá.')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const savedReview = ownReview
        ? await reviewService.updateOwned(
            ownReview.id,
            user.id,
            {
              rating,
              title,
              content,
            },
          )
        : await reviewService.create({
            candidateId: user.id,
            employerId: company.id,
            rating,
            title,
            content,
          })

      setReviews((current) => sortReviews(
        ownReview
          ? current.map((review) =>
              review.id === savedReview.id
                ? savedReview
                : review,
            )
          : [savedReview, ...current],
      ))

      setTitle(savedReview.title)
      setContent(savedReview.content)
      setCurrentPage(1)

      showToast(
        ownReview
          ? 'Đã cập nhật đánh giá công ty.'
          : 'Đã gửi đánh giá công ty.',
        'success',
      )
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : 'Không thể lưu đánh giá.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!ownReview || user?.role !== 'candidate') return

    if (
      !window.confirm(
        'Bạn có chắc muốn xóa đánh giá này? Thao tác này không thể hoàn tác.',
      )
    ) {
      return
    }

    setDeleting(true)
    setFormError('')

    try {
      await reviewService.removeOwned(
        ownReview.id,
        user.id,
      )

      setReviews((current) =>
        current.filter((review) => review.id !== ownReview.id),
      )

      setRating(0)
      setTitle('')
      setContent('')
      setCurrentPage(1)

      showToast(
        'Đã xóa đánh giá công ty.',
        'success',
      )
    } catch (deleteError) {
      setFormError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Không thể xóa đánh giá.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const toggleCompanyFollow = async () => {
    if (!company || user?.role !== 'candidate') return

    setTogglingFollow(true)

    try {
      if (ownFollow) {
        await companyFollowService.removeOwned(
          ownFollow.id,
          user.id,
        )

        setCompanyFollows((current) =>
          current.filter(
            (follow) => follow.id !== ownFollow.id,
          ),
        )

        showToast(
          'Đã bỏ theo dõi công ty. Bạn sẽ không nhận thông báo việc làm mới.',
          'success',
        )
      } else {
        const createdFollow =
          await companyFollowService.create(
            user.id,
            company.id,
          )

        setCompanyFollows((current) => [
          ...current,
          createdFollow,
        ])

        showToast(
          'Đã theo dõi công ty. Bạn sẽ nhận thông báo khi có việc làm mới.',
          'success',
        )
      }
    } catch (followError) {
      showToast(
        followError instanceof Error
          ? followError.message
          : 'Không thể cập nhật theo dõi công ty.',
        'error',
      )
    } finally {
      setTogglingFollow(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Loading label="Đang tải thông tin công ty..." />
      </div>
    )
  }

  if (error || !company?.companyProfile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-slate-950">
          Không tìm thấy công ty
        </h1>

        <p className="mt-3 text-slate-500">
          {error}
        </p>

        <Link
          className="mt-6 inline-block font-bold text-emerald-700"
          to="/companies"
        >
          ← Xem danh sách công ty
        </Link>
      </div>
    )
  }

  const profile = company.companyProfile

  const websiteUrl = /^https?:\/\//i.test(profile.website)
    ? profile.website
    : ''

  const requestedBackPath = (
    location.state as {
      from?: string
    } | null
  )?.from

  const backPath =
    requestedBackPath &&
    /^\/jobs\/[^/]+$/.test(requestedBackPath)
      ? requestedBackPath
      : '/companies'

  const backLabel =
    backPath === '/companies'
      ? 'Quay lại danh sách công ty'
      : 'Quay lại tin tuyển dụng'

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        className="text-sm font-bold text-emerald-700"
        to={backPath}
      >
        ← {backLabel}
      </Link>

      <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-6 py-8 text-white sm:px-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-3xl font-black text-slate-950">
              {profile.name.charAt(0)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                Hồ sơ doanh nghiệp
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                {profile.name}
              </h1>

              <p className="mt-2 text-slate-300">
                {profile.industry} · {profile.companySize}
              </p>
            </div>

            <div className="space-y-3 sm:text-right">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-3xl font-black text-amber-300">
                    {averageRating.toFixed(1)}
                  </span>

                  <StarRating
                    size="sm"
                    value={averageRating}
                  />
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  {reviews.length} đánh giá
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {companyFollows.length} người theo dõi
                </p>
              </div>

              {user?.role === 'candidate' ? (
                <button
                  aria-pressed={Boolean(ownFollow)}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm font-black transition disabled:opacity-60 ${
                    ownFollow
                      ? 'border border-emerald-400 bg-transparent text-emerald-300 hover:bg-emerald-400/10'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  }`}
                  disabled={togglingFollow}
                  onClick={() =>
                    void toggleCompanyFollow()
                  }
                  type="button"
                >
                  {togglingFollow
                    ? 'Đang cập nhật...'
                    : ownFollow
                      ? '✓ Đang theo dõi'
                      : '+ Theo dõi công ty'}
                </button>
              ) : !user ? (
                <Link
                  className="block rounded-xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-black text-slate-950 hover:bg-emerald-400"
                  state={{
                    from: `/companies/${company.id}`,
                  }}
                  to="/login"
                >
                  Đăng nhập để theo dõi
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-7 p-6 sm:p-9 lg:grid-cols-[1fr_300px]">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Giới thiệu công ty
            </h2>

            <p className="mt-3 whitespace-pre-line leading-7 text-slate-600">
              {profile.description ||
                'Công ty chưa cập nhật phần giới thiệu.'}
            </p>
          </div>

          <dl className="space-y-4 rounded-2xl bg-slate-50 p-5 text-sm">
            <div>
              <dt className="text-slate-400">
                Địa chỉ
              </dt>

              <dd className="mt-1 font-semibold text-slate-700">
                {profile.address || 'Chưa cập nhật'}
              </dd>
            </div>

            <div>
              <dt className="text-slate-400">
                Quy mô
              </dt>

              <dd className="mt-1 font-semibold text-slate-700">
                {profile.companySize || 'Chưa cập nhật'}
              </dd>
            </div>

            <div>
              <dt className="text-slate-400">
                Việc làm đang mở
              </dt>

              <dd className="mt-1 font-semibold text-slate-700">
                {openJobs.length} vị trí
              </dd>
            </div>

            {websiteUrl && (
              <div>
                <dt className="text-slate-400">
                  Website
                </dt>

                <dd className="mt-1">
                  <a
                    className="font-bold text-emerald-700 hover:underline"
                    href={websiteUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Truy cập website ↗
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">
              Cơ hội nghề nghiệp
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Việc làm tại {profile.name}
            </h2>
          </div>

          <Link
            className="text-sm font-bold text-emerald-700"
            to="/jobs"
          >
            Xem tất cả việc làm →
          </Link>
        </div>

        {openJobs.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Công ty hiện chưa có vị trí đang mở.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {openJobs.slice(0, 4).map((job) => (
              <Link
                className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40"
                key={job.id}
                state={{
                  from: `/companies/${company.id}`,
                }}
                to={`/jobs/${job.id}`}
              >
                <h3 className="font-black text-slate-900">
                  {job.title}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {job.location} · Hạn {formatDate(job.deadline)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">
            Tổng quan đánh giá
          </h2>

          <div className="mt-5 flex items-end gap-3">
            <span className="text-5xl font-black text-slate-950">
              {averageRating.toFixed(1)}
            </span>

            <div>
              <StarRating
                size="sm"
                value={averageRating}
              />

              <p className="mt-1 text-xs text-slate-400">
                Từ {reviews.length} đánh giá
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {ratingOptions.map((value) => {
              const count = ratingCounts[value]

              const percentage =
                reviews.length === 0
                  ? 0
                  : (count / reviews.length) * 100

              return (
                <div
                  className="grid grid-cols-[38px_1fr_28px] items-center gap-2 text-xs"
                  key={value}
                >
                  <span className="font-bold text-slate-600">
                    {value} ★
                  </span>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>

                  <span className="text-right text-slate-400">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </aside>

        <div className="space-y-6">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-slate-950">
              {ownReview
                ? 'Chỉnh sửa đánh giá của bạn'
                : 'Đánh giá công ty này'}
            </h2>

            {user?.role === 'candidate' ? (
              hasAppliedToCompany ? (
                <form
                  className="mt-5 space-y-5"
                  onSubmit={handleSubmit}
                >
                  <div>
                    <p className="label">
                      Mức độ hài lòng
                    </p>

                    <div className="mt-2">
                      <StarRating
                        label="Chọn mức đánh giá từ 1 đến 5 sao"
                        onChange={(value) => {
                          setRating(value)
                          setFormError('')
                        }}
                        size="lg"
                        value={rating}
                      />
                    </div>
                  </div>

                  <label className="block">
                    <span className="label">
                      Tiêu đề
                    </span>

                    <input
                      className="field mt-2"
                      maxLength={100}
                      minLength={3}
                      onChange={(event) =>
                        setTitle(event.target.value)
                      }
                      placeholder="Tóm tắt trải nghiệm của bạn"
                      required
                      value={title}
                    />
                  </label>

                  <label className="block">
                    <span className="label">
                      Nội dung đánh giá
                    </span>

                    <textarea
                      className="field mt-2 min-h-32 resize-y"
                      maxLength={1000}
                      minLength={10}
                      onChange={(event) =>
                        setContent(event.target.value)
                      }
                      placeholder="Chia sẻ trải nghiệm tuyển dụng hoặc môi trường làm việc..."
                      required
                      value={content}
                    />
                  </label>

                  {formError && (
                    <p
                      className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
                      role="alert"
                    >
                      {formError}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      disabled={
                        submitting || deleting
                      }
                      type="submit"
                    >
                      {submitting
                        ? 'Đang lưu...'
                        : ownReview
                          ? 'Lưu thay đổi'
                          : 'Gửi đánh giá'}
                    </button>

                    {ownReview && (
                      <button
                        className="rounded-xl border border-red-200 px-5 py-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        disabled={
                          submitting || deleting
                        }
                        onClick={() =>
                          void handleDelete()
                        }
                        type="button"
                      >
                        {deleting
                          ? 'Đang xóa...'
                          : 'Xóa đánh giá'}
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-black">
                    Bạn chưa thể đánh giá công ty này.
                  </p>

                  <p className="mt-1">
                    Bạn cần ứng tuyển ít nhất một vị trí tại công ty trước khi có thể viết đánh giá.
                  </p>

                  {openJobs.length > 0 && (
                    <Link
                      className="mt-3 inline-block font-black text-amber-900 underline"
                      state={{
                        from: `/companies/${company.id}`,
                      }}
                      to={`/jobs/${openJobs[0].id}`}
                    >
                      Xem vị trí đang tuyển →
                    </Link>
                  )}
                </div>
              )
            ) : user ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Chỉ tài khoản ứng viên mới có thể gửi đánh giá. Bạn vẫn có thể xem toàn bộ nhận xét bên dưới.
              </p>
            ) : (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                Bạn cần{' '}
                <Link
                  className="font-black underline"
                  state={{
                    from: `/companies/${company.id}`,
                  }}
                  to="/login"
                >
                  đăng nhập bằng tài khoản ứng viên
                </Link>{' '}
                để gửi đánh giá.
              </div>
            )}
          </article>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">
                  Nhận xét
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Đánh giá từ ứng viên
                </h2>
              </div>

              <span className="text-sm font-semibold text-slate-400">
                {reviews.length} đánh giá
              </span>
            </div>

            {reviews.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  description="Hãy là người đầu tiên chia sẻ trải nghiệm với công ty này."
                  title="Chưa có đánh giá"
                />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {paginatedReviews.map((review) => (
                  <article
                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                      review.id === ownReview?.id
                        ? 'border-emerald-300 ring-1 ring-emerald-100'
                        : 'border-slate-200'
                    }`}
                    key={review.id}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="flex gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 font-black text-slate-600">
                          {(
                            candidateNames.get(
                              review.candidateId,
                            ) ?? 'Ứng viên'
                          ).charAt(0)}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-slate-900">
                              {candidateNames.get(
                                review.candidateId,
                              ) ??
                                'Ứng viên JobHub'}
                            </h3>

                            {review.id ===
                              ownReview?.id && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                                Đánh giá của bạn
                              </span>
                            )}
                          </div>

                          <StarRating
                            label={`${review.rating} trên 5 sao`}
                            size="sm"
                            value={review.rating}
                          />
                        </div>
                      </div>

                      <time
                        className="text-xs text-slate-400"
                        dateTime={review.updatedAt}
                      >
                        {formatDate(review.updatedAt)}
                      </time>
                    </div>

                    <h4 className="mt-4 font-black text-slate-900">
                      {review.title}
                    </h4>

                    <p className="mt-2 whitespace-pre-line leading-7 text-slate-600">
                      {review.content}
                    </p>
                  </article>
                ))}
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              totalPages={totalPages}
            />
          </div>
        </div>
      </section>
    </div>
  )
}