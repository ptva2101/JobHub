import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { Pagination } from '../../components/common/Pagination'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { jobModerationService } from '../../services/jobModerationService'
import type { Job, JobStatus, ModerationStatus } from '../../types/job'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'
import { isJobExpired } from '../../utils/isJobExpired'
import { getJobModerationStatus } from '../../utils/jobModeration'

const PAGE_SIZE = 10
const moderationStatuses: ModerationStatus[] = [
  'unsubmitted',
  'pending',
  'approved',
  'rejected',
  'hidden',
]

const moderationMeta: Record<
  ModerationStatus,
  { label: string; className: string; description: string }
> = {
  unsubmitted: {
    label: 'Chưa gửi duyệt',
    className: 'bg-slate-100 text-slate-700',
    description: 'Nhà tuyển dụng chưa gửi tin cho Admin kiểm duyệt.',
  },
  pending: {
    label: 'Chờ duyệt',
    className: 'bg-amber-100 text-amber-800',
    description: 'Tin đang chờ Admin phê duyệt hoặc từ chối.',
  },
  approved: {
    label: 'Đã duyệt',
    className: 'bg-emerald-100 text-emerald-800',
    description: 'Tin đã vượt qua bước kiểm duyệt.',
  },
  rejected: {
    label: 'Từ chối',
    className: 'bg-red-100 text-red-800',
    description: 'Tin bị từ chối và cần nhà tuyển dụng điều chỉnh.',
  },
  hidden: {
    label: 'Đã ẩn',
    className: 'bg-violet-100 text-violet-800',
    description: 'Tin đã duyệt nhưng bị Admin ẩn khỏi khu vực công khai.',
  },
}

const jobStatusMeta: Record<JobStatus, { label: string; className: string }> = {
  draft: { label: 'Bản nháp', className: 'bg-slate-100 text-slate-700' },
  open: { label: 'Đang tuyển', className: 'bg-blue-100 text-blue-800' },
  closed: { label: 'Đã đóng', className: 'bg-slate-200 text-slate-700' },
}

type ReasonAction = 'reject' | 'hide'

interface ReasonDialogState {
  action: ReasonAction
  job: Job
}

function actionLabel(action: ReasonAction) {
  return action === 'reject' ? 'Từ chối tin tuyển dụng' : 'Ẩn tin tuyển dụng'
}

export function AdminJobsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [keyword, setKeyword] = useState('')
  const [moderationFilter, setModerationFilter] = useState<ModerationStatus | ''>('')
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatus | ''>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [previewJob, setPreviewJob] = useState<Job | null>(null)
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [processingId, setProcessingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    if (!user || user.role !== 'admin') return

    jobModerationService
      .list(user.id)
      .then((data) => {
        if (!active) return
        setJobs(data)
        setCurrentPage(1)
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Không thể tải danh sách tin cần kiểm duyệt.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadToken, user])

  const categoryOptions = useMemo(
    () => [...new Set(jobs.map((job) => job.category))].sort((a, b) => a.localeCompare(b, 'vi')),
    [jobs],
  )
  const locationOptions = useMemo(
    () => [...new Set(jobs.map((job) => job.location))].sort((a, b) => a.localeCompare(b, 'vi')),
    [jobs],
  )
  const moderationCounts = useMemo(
    () => Object.fromEntries(
      moderationStatuses.map((status) => [
        status,
        jobs.filter((job) => getJobModerationStatus(job) === status).length,
      ]),
    ) as Record<ModerationStatus, number>,
    [jobs],
  )
  const filteredJobs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    return jobs.filter((job) => {
      const matchesKeyword =
        !normalizedKeyword ||
        job.title.toLocaleLowerCase('vi').includes(normalizedKeyword) ||
        job.companyName.toLocaleLowerCase('vi').includes(normalizedKeyword) ||
        job.id.toLocaleLowerCase('vi').includes(normalizedKeyword)
      return (
        matchesKeyword &&
        (!moderationFilter || getJobModerationStatus(job) === moderationFilter) &&
        (!jobStatusFilter || job.status === jobStatusFilter) &&
        (!categoryFilter || job.category === categoryFilter) &&
        (!locationFilter || job.location === locationFilter)
      )
    })
  }, [categoryFilter, jobStatusFilter, jobs, keyword, locationFilter, moderationFilter])

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const firstResult = filteredJobs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastResult = Math.min(currentPage * PAGE_SIZE, filteredJobs.length)

  const resetPage = () => setCurrentPage(1)
  const replaceJob = (updatedJob: Job) => {
    setJobs((current) =>
      current.map((job) => (job.id === updatedJob.id ? updatedJob : job)),
    )
    setPreviewJob((current) => (current?.id === updatedJob.id ? updatedJob : current))
  }

  const approveJob = async (job: Job) => {
    if (!user || user.role !== 'admin' || processingId) return
    if (!window.confirm(`Duyệt tin “${job.title}”?`)) return

    setProcessingId(job.id)
    try {
      const result = await jobModerationService.approve(job.id, user.id)
      replaceJob(result.job)
      if (result.notificationWarning) {
        showToast(
          `Tin đã được duyệt, nhưng thông báo tới người theo dõi chưa hoàn tất: ${result.notificationWarning}`,
          'info',
        )
      } else {
        showToast(
          result.notificationsCreated > 0
            ? `Đã duyệt tin và gửi ${result.notificationsCreated} thông báo tới người theo dõi.`
            : 'Đã duyệt tin tuyển dụng.',
          'success',
        )
      }
    } catch (approveError) {
      showToast(
        approveError instanceof Error ? approveError.message : 'Không thể duyệt tin tuyển dụng.',
        'error',
      )
    } finally {
      setProcessingId('')
    }
  }

  const openReasonDialog = (job: Job, action: ReasonAction) => {
    setReasonDialog({ job, action })
    setReason('')
    setActionError('')
  }

  const submitReasonAction = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || user.role !== 'admin' || !reasonDialog || processingId) return
    if (!reason.trim()) {
      setActionError('Vui lòng nhập lý do kiểm duyệt.')
      return
    }

    setProcessingId(reasonDialog.job.id)
    setActionError('')
    try {
      const updatedJob = reasonDialog.action === 'reject'
        ? await jobModerationService.reject(reasonDialog.job.id, user.id, reason)
        : await jobModerationService.hide(reasonDialog.job.id, user.id, reason)
      replaceJob(updatedJob)
      showToast(
        reasonDialog.action === 'reject'
          ? 'Đã từ chối tin tuyển dụng.'
          : 'Đã ẩn tin tuyển dụng khỏi khu vực công khai.',
        'success',
      )
      setReasonDialog(null)
      setReason('')
    } catch (moderationError) {
      setActionError(
        moderationError instanceof Error
          ? moderationError.message
          : 'Không thể cập nhật trạng thái kiểm duyệt.',
      )
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold text-emerald-600">KIỂM DUYỆT NỘI DUNG</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Quản lý tin tuyển dụng</h1>
          <p className="mt-2 text-slate-500">
            Xem xét, phê duyệt và ẩn các tin tuyển dụng trên hệ thống.
          </p>
        </div>
        {!loading && !error && (
          <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
            <p className="text-2xl font-black">{jobs.length}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Tổng số tin</p>
          </div>
        )}
      </div>

      {!loading && !error && (
        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Thống kê kiểm duyệt">
          {moderationStatuses.map((status) => {
            const meta = moderationMeta[status]
            return (
              <button
                className={`rounded-2xl p-4 text-left shadow-sm ${
                  moderationFilter === status
                    ? 'bg-slate-900 text-white ring-2 ring-emerald-400'
                    : 'bg-white text-slate-900 hover:ring-2 hover:ring-emerald-200'
                }`}
                key={status}
                onClick={() => {
                  setModerationFilter((current) => current === status ? '' : status)
                  resetPage()
                }}
                title={meta.description}
                type="button"
              >
                <p className={moderationFilter === status ? 'text-2xl font-black text-emerald-400' : 'text-2xl font-black text-emerald-600'}>
                  {moderationCounts[status]}
                </p>
                <p className={moderationFilter === status ? 'mt-1 text-xs font-bold text-slate-300' : 'mt-1 text-xs font-bold text-slate-500'}>
                  {meta.label}
                </p>
              </button>
            )
          })}
        </section>
      )}

      {!loading && !error && (
        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm" aria-label="Bộ lọc tin tuyển dụng">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="xl:col-span-2">
              <span className="sr-only">Tìm kiếm tin</span>
              <input
                className="field"
                onChange={(event) => { setKeyword(event.target.value); resetPage() }}
                placeholder="Tiêu đề, công ty hoặc mã tin..."
                type="search"
                value={keyword}
              />
            </label>
            <select
              aria-label="Lọc trạng thái tin"
              className="field"
              onChange={(event) => { setJobStatusFilter(event.target.value as JobStatus | ''); resetPage() }}
              value={jobStatusFilter}
            >
              <option value="">Mọi trạng thái tin</option>
              <option value="open">Đang tuyển</option>
              <option value="draft">Bản nháp</option>
              <option value="closed">Đã đóng</option>
            </select>
            <select
              aria-label="Lọc ngành nghề"
              className="field"
              onChange={(event) => { setCategoryFilter(event.target.value); resetPage() }}
              value={categoryFilter}
            >
              <option value="">Mọi ngành nghề</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select
              aria-label="Lọc địa điểm"
              className="field"
              onChange={(event) => { setLocationFilter(event.target.value); resetPage() }}
              value={locationFilter}
            >
              <option value="">Mọi địa điểm</option>
              {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              className="text-sm font-bold text-emerald-700 hover:text-emerald-800"
              onClick={() => {
                setKeyword('')
                setModerationFilter('')
                setJobStatusFilter('')
                setCategoryFilter('')
                setLocationFilter('')
                resetPage()
              }}
              type="button"
            >
              Xóa toàn bộ bộ lọc
            </button>
          </div>
        </section>
      )}

      <div className="mt-6">
        {loading ? (
          <Loading label="Đang tải danh sách tin kiểm duyệt..." />
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="font-semibold text-red-700" role="alert">{error}</p>
            <button
              className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              onClick={() => {
                setLoading(true)
                setError('')
                setReloadToken((current) => current + 1)
              }}
              type="button"
            >
              Thử tải lại
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            description="Hãy thay đổi từ khóa hoặc bộ lọc để xem các tin khác."
            title="Không có tin tuyển dụng phù hợp"
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Đang hiển thị {firstResult}–{lastResult} trong {filteredJobs.length} tin
            </p>
            <div className="space-y-4">
              {paginatedJobs.map((job) => {
                const moderationStatus = getJobModerationStatus(job)
                const moderation = moderationMeta[moderationStatus]
                const jobStatus = jobStatusMeta[job.status]
                const processing = processingId === job.id
                return (
                  <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6" key={job.id}>
                    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black text-slate-950">{job.title}</h2>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${moderation.className}`}>{moderation.label}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${jobStatus.className}`}>{jobStatus.label}</span>
                          {job.status === 'open' && isJobExpired(job.deadline) && (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">Hết hạn</span>
                          )}
                        </div>
                        <p className="mt-2 font-bold text-emerald-700">{job.companyName}</p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                          <span>{job.category}</span>
                          <span>{job.location}</span>
                          <span>Hạn {formatDate(job.deadline)}</span>
                          <span className="font-mono text-xs">{job.id}</span>
                        </div>
                        {(moderationStatus === 'rejected' || moderationStatus === 'hidden') && job.moderationReason && (
                          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                            <strong>Lý do:</strong> {job.moderationReason}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          onClick={() => setPreviewJob(job)}
                          type="button"
                        >
                          Xem nhanh
                        </button>
                        <Link
                          className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                          state={{ from: '/admin/jobs' }}
                          to={`/jobs/${job.id}`}
                        >
                          Mở trang tin
                        </Link>
                        {(moderationStatus === 'pending' || moderationStatus === 'rejected' || moderationStatus === 'hidden') && (
                          <button
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            disabled={processing}
                            onClick={() => void approveJob(job)}
                            type="button"
                          >
                            {processing ? 'Đang xử lý...' : 'Duyệt tin'}
                          </button>
                        )}
                        {moderationStatus === 'pending' && (
                          <button
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            disabled={processing}
                            onClick={() => openReasonDialog(job, 'reject')}
                            type="button"
                          >
                            Từ chối
                          </button>
                        )}
                        {moderationStatus === 'approved' && (
                          <button
                            className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                            disabled={processing}
                            onClick={() => openReasonDialog(job, 'hide')}
                            type="button"
                          >
                            Ẩn tin
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            <Pagination currentPage={currentPage} onPageChange={setCurrentPage} totalPages={totalPages} />
          </>
        )}
      </div>

      {previewJob && (
        <div aria-labelledby="admin-job-preview-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
          <article className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-600">XEM TRƯỚC TIN TUYỂN DỤNG</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950" id="admin-job-preview-title">{previewJob.title}</h2>
                <p className="mt-1 font-semibold text-slate-500">{previewJob.companyName}</p>
              </div>
              <button aria-label="Đóng xem trước" className="rounded-lg p-2 text-xl text-slate-400 hover:bg-slate-100" onClick={() => setPreviewJob(null)} type="button">×</button>
            </div>
            <dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-400">Ngành nghề</dt><dd className="mt-1 font-bold text-slate-700">{previewJob.category}</dd></div>
              <div><dt className="text-slate-400">Địa điểm</dt><dd className="mt-1 font-bold text-slate-700">{previewJob.location}</dd></div>
              <div><dt className="text-slate-400">Mức lương</dt><dd className="mt-1 font-bold text-slate-700">{previewJob.salary.negotiable ? 'Thỏa thuận' : `${formatCurrency(previewJob.salary.min, previewJob.salary.currency)} – ${formatCurrency(previewJob.salary.max, previewJob.salary.currency)}`}</dd></div>
              <div><dt className="text-slate-400">Hạn nộp</dt><dd className="mt-1 font-bold text-slate-700">{formatDate(previewJob.deadline)}</dd></div>
            </dl>
            <section className="mt-6"><h3 className="font-black text-slate-900">Mô tả công việc</h3><p className="mt-2 whitespace-pre-line leading-7 text-slate-600">{previewJob.description}</p></section>
            <section className="mt-6"><h3 className="font-black text-slate-900">Yêu cầu</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-slate-600">{previewJob.requirements.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section className="mt-6"><h3 className="font-black text-slate-900">Quyền lợi</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-slate-600">{previewJob.benefits.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50" onClick={() => setPreviewJob(null)} type="button">Đóng</button>
              <Link className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800" state={{ from: '/admin/jobs' }} to={`/jobs/${previewJob.id}`}>Mở trang tin →</Link>
            </div>
          </article>
        </div>
      )}

      {reasonDialog && (
        <div aria-labelledby="moderation-reason-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
          <form className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8" onSubmit={submitReasonAction}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-red-600">KIỂM DUYỆT TIN</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950" id="moderation-reason-title">{actionLabel(reasonDialog.action)}</h2>
                <p className="mt-2 text-sm text-slate-500">{reasonDialog.job.title} · {reasonDialog.job.companyName}</p>
              </div>
              <button aria-label="Đóng" className="rounded-lg p-2 text-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled={Boolean(processingId)} onClick={() => setReasonDialog(null)} type="button">×</button>
            </div>
            <label className="mt-6 block">
              <span className="label">Lý do *</span>
              <textarea
                autoFocus
                className="field mt-2 min-h-32 resize-y"
                maxLength={500}
                onChange={(event) => { setReason(event.target.value); setActionError('') }}
                placeholder={reasonDialog.action === 'reject' ? 'Nêu nội dung nhà tuyển dụng cần chỉnh sửa...' : 'Nêu lý do tin không còn phù hợp để hiển thị...'}
                required
                value={reason}
              />
              <span className="mt-1 block text-right text-xs text-slate-400">{reason.length}/500</span>
            </label>
            {actionError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700 disabled:opacity-50" disabled={Boolean(processingId)} onClick={() => setReasonDialog(null)} type="button">Hủy</button>
              <button className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50" disabled={Boolean(processingId) || !reason.trim()} type="submit">{processingId ? 'Đang xử lý...' : 'Xác nhận'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
