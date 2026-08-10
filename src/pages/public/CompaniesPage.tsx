import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { jobService } from '../../services/jobService'
import { reviewService } from '../../services/reviewService'
import { userService } from '../../services/userService'
import type { CompanyProfile, User } from '../../types/user'

interface CompanyItem {
  employer: User & { companyProfile: CompanyProfile }
  averageRating: number
  reviewCount: number
  openJobCount: number
}

function getCompanyInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi'))
    .join('')
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([userService.getAll(), reviewService.getAll(), jobService.getAll()])
      .then(([users, reviews, openJobs]) => {
        if (!active) return

        const employerReviews = new Map<string, { count: number; totalRating: number }>()
        reviews.forEach((review) => {
          const current = employerReviews.get(review.employerId) ?? {
            count: 0,
            totalRating: 0,
          }
          employerReviews.set(review.employerId, {
            count: current.count + 1,
            totalRating: current.totalRating + review.rating,
          })
        })

        const employerOpenJobs = new Map<string, number>()
        openJobs.forEach((job) => {
          employerOpenJobs.set(job.employerId, (employerOpenJobs.get(job.employerId) ?? 0) + 1)
        })

        const employerUsers = users.filter(
          (user): user is User & { companyProfile: CompanyProfile } =>
            user.role === 'employer' && user.companyProfile !== null,
        )

        setCompanies(
          employerUsers
            .map((employer) => {
              const reviewSummary = employerReviews.get(employer.id)
              return {
                employer,
                reviewCount: reviewSummary?.count ?? 0,
                averageRating: reviewSummary
                  ? reviewSummary.totalRating / reviewSummary.count
                  : 0,
                openJobCount: employerOpenJobs.get(employer.id) ?? 0,
              }
            })
            .sort((a, b) =>
              a.employer.companyProfile.name.localeCompare(
                b.employer.companyProfile.name,
                'vi',
              ),
            ),
        )
        setError('')
      })
      .catch(() => {
        if (active) {
          setError('Không thể tải danh sách công ty. Hãy kiểm tra kết nối tới mock API.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const filteredCompanies = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    if (!normalizedKeyword) return companies

    return companies.filter(({ employer }) => {
      const profile = employer.companyProfile
      return [profile.name, profile.industry, profile.address].some((value) =>
        value.toLocaleLowerCase('vi').includes(normalizedKeyword),
      )
    })
  }, [companies, keyword])

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">
            Khám phá doanh nghiệp
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Tìm hiểu nơi bạn muốn làm việc
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Xem thông tin, cơ hội đang tuyển và đánh giá thực tế về các công ty trên JobHub.
          </p>
        </div>
        {!loading && !error && (
          <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-900">
            <p className="text-2xl font-black">{companies.length}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Doanh nghiệp
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="sr-only">Tìm kiếm công ty</span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="field"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo tên công ty, ngành nghề hoặc địa điểm..."
              type="search"
              value={keyword}
            />
            {keyword && (
              <button
                className="shrink-0 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setKeyword('')}
                type="button"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        </label>
      </div>

      <div className="mt-6">
        {loading ? (
          <Loading label="Đang tải danh sách công ty..." />
        ) : error ? (
          <p className="rounded-xl bg-red-50 p-4 font-semibold text-red-700" role="alert">
            {error}
          </p>
        ) : filteredCompanies.length === 0 ? (
          <EmptyState
            description={
              companies.length === 0
                ? 'Chưa có doanh nghiệp nào trên hệ thống.'
                : 'Hãy thử tìm bằng tên công ty, ngành nghề hoặc địa điểm khác.'
            }
            title={companies.length === 0 ? 'Chưa có công ty' : 'Không tìm thấy công ty phù hợp'}
          />
        ) : (
          <>
            <p className="mb-5 text-sm text-slate-500">
              Hiển thị <span className="font-bold text-slate-800">{filteredCompanies.length}</span>{' '}
              công ty
            </p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCompanies.map(
                ({ employer, averageRating, reviewCount, openJobCount }) => {
                  const profile = employer.companyProfile
                  return (
                    <Link
                      className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md sm:p-6"
                      key={employer.id}
                      to={`/companies/${employer.id}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-700">
                          {getCompanyInitials(profile.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-lg font-black text-slate-950 transition group-hover:text-emerald-700">
                            {profile.name}
                          </h2>
                          <p className="mt-1 truncate text-sm font-semibold text-emerald-700">
                            {profile.industry}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                          {openJobCount} việc mở
                        </span>
                      </div>

                      <div className="mt-5 space-y-3 text-sm text-slate-600">
                        <p className="flex items-start gap-2">
                          <span aria-hidden="true" className="text-slate-400">⌖</span>
                          <span>{profile.address}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span aria-hidden="true" className="text-slate-400">♙</span>
                          <span>{profile.companySize}</span>
                        </p>
                      </div>

                      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5">
                        {reviewCount > 0 ? (
                          <p className="text-sm text-slate-500">
                            <span className="font-black text-amber-500">★ {averageRating.toFixed(1)}</span>
                            <span> · {reviewCount} đánh giá</span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">Chưa có đánh giá</p>
                        )}
                        <span className="text-sm font-bold text-emerald-700">Xem công ty →</span>
                      </div>
                    </Link>
                  )
                },
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
