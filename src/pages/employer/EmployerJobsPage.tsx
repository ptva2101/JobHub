import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { applicationService } from '../../services/applicationService'
import { jobService } from '../../services/jobService'
import { notificationService } from '../../services/notificationService'
import type { Job, JobStatus, ModerationStatus } from '../../types/job'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'
import { isJobExpired } from '../../utils/isJobExpired'
import { getJobModerationStatus, isPublicJob } from '../../utils/jobModeration'

interface EmployerJobItem {
  job: Job
  applicationCount: number
}

const statusMeta: Record<JobStatus, { label: string; className: string }> = {
  draft: { label: 'Bản nháp', className: 'bg-slate-100 text-slate-700' },
  open: { label: 'Đang tuyển', className: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Đã đóng', className: 'bg-red-100 text-red-700' },
}

const moderationMeta: Record<ModerationStatus, { label: string; className: string }> = {
  unsubmitted: { label: 'Chưa gửi duyệt', className: 'bg-slate-100 text-slate-700' },
  pending: { label: 'Chờ Admin duyệt', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Đã duyệt', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Bị từ chối', className: 'bg-red-100 text-red-800' },
  hidden: { label: 'Admin đã ẩn', className: 'bg-violet-100 text-violet-800' },
}

export function EmployerJobsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState<EmployerJobItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<JobStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState('')

  useEffect(() => {
    let active = true
    if (!user) return

    jobService
      .getByEmployer(user.id)
      .then(async (jobs) =>
        Promise.all(
          jobs.map(async (job) => ({
            job,
            applicationCount: (await applicationService.getByJob(job.id)).length,
          })),
        ),
      )
      .then((data) => {
        if (!active) return
        setItems(data.sort((a, b) => b.job.createdAt.localeCompare(a.job.createdAt)))
        setError('')
      })
      .catch(() => active && setError('Không thể tải danh sách tin tuyển dụng.'))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [user])

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    return items.filter(({ job }) => {
      const matchesKeyword =
        !normalizedKeyword ||
        job.title.toLocaleLowerCase('vi').includes(normalizedKeyword) ||
        job.location.toLocaleLowerCase('vi').includes(normalizedKeyword)
      return matchesKeyword && (!status || job.status === status)
    })
  }, [items, keyword, status])

  const toggleStatus = async (job: Job) => {
    if (!user) return
    const nextStatus: JobStatus = job.status === 'open' ? 'closed' : 'open'
    if (nextStatus === 'open' && isJobExpired(job.deadline)) {
      showToast('Hãy sửa hạn nộp trước khi mở lại tin đã hết hạn.', 'error')
      return
    }

    setProcessingId(job.id)
    try {
      const updatedJob = await jobService.updateOwned(job.id, user.id, { status: nextStatus })
      setItems((current) =>
        current.map((item) => (item.job.id === job.id ? { ...item, job: updatedJob } : item)),
      )
      if (!isPublicJob(job) && isPublicJob(updatedJob)) {
        try {
          const createdNotifications = await notificationService.notifyFollowersForJob(updatedJob)
          showToast(
            createdNotifications.length > 0
              ? `Đã mở tin và gửi ${createdNotifications.length} thông báo tới người theo dõi.`
              : 'Đã mở tin tuyển dụng.',
            'success',
          )
        } catch {
          showToast(
            'Tin đã được mở thành công, nhưng chưa thể gửi đủ thông báo tới người theo dõi.',
            'info',
          )
        }
      } else if (updatedJob.moderationStatus === 'pending') {
        showToast('Tin đã được gửi tới Admin chờ duyệt.', 'success')
      } else if (nextStatus === 'open') {
        showToast('Đã mở tin tuyển dụng.', 'success')
      } else {
        showToast('Đã đóng tin tuyển dụng.', 'success')
      }
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'Không thể cập nhật trạng thái tin.', 'error')
    } finally {
      setProcessingId('')
    }
  }

  const removeJob = async (item: EmployerJobItem) => {
    if (!user) return
    if (item.applicationCount > 0) {
      showToast('Không thể xóa tin đã có hồ sơ ứng tuyển. Hãy đóng tin để giữ lịch sử ứng viên.', 'error')
      return
    }
    if (!window.confirm(`Bạn chắc chắn muốn xóa “${item.job.title}”? Các bookmark liên quan (nếu có) cũng sẽ bị xóa.`)) return

    setProcessingId(item.job.id)
    try {
      await jobService.removeOwned(item.job.id, user.id)
      setItems((current) => current.filter(({ job }) => job.id !== item.job.id))
      showToast('Đã xóa tin tuyển dụng.', 'success')
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'Không thể xóa tin tuyển dụng.', 'error')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold text-emerald-600">TUYỂN DỤNG</p><h1 className="mt-1 text-3xl font-black text-slate-950">Tin tuyển dụng của tôi</h1><p className="mt-2 text-slate-500">Tạo và quản lý các vị trí của doanh nghiệp.</p></div>
        <Link className="w-fit rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700" to="/employer/jobs/create">+ Đăng tin mới</Link>
      </div>

      <div className="mt-7 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_190px]">
        <label><span className="sr-only">Tìm tin tuyển dụng</span><input className="field" onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo vị trí hoặc địa điểm..." value={keyword} /></label>
        <select aria-label="Lọc trạng thái" className="field" onChange={(event) => setStatus(event.target.value as JobStatus | '')} value={status}><option value="">Mọi trạng thái</option><option value="open">Đang tuyển</option><option value="draft">Bản nháp</option><option value="closed">Đã đóng</option></select>
      </div>

      <div className="mt-6">
        {loading ? <Loading /> : error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : filteredItems.length === 0 ? <EmptyState title="Không có tin tuyển dụng phù hợp" description="Hãy thay đổi bộ lọc hoặc tạo tin tuyển dụng đầu tiên." /> : <div className="space-y-4">{filteredItems.map((item) => {
          const { job } = item
          const meta = statusMeta[job.status]
          const moderation = moderationMeta[getJobModerationStatus(job)]
          const processing = processingId === job.id
          return <article className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" key={job.id}><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-black text-slate-950">{job.title}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${moderation.className}`}>{moderation.label}</span>{job.status === 'open' && isJobExpired(job.deadline) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Hết hạn</span>}</div>{job.moderationReason && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Lý do kiểm duyệt: {job.moderationReason}</p>}<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span>{job.location}</span><span>{job.salary.negotiable ? 'Lương thỏa thuận' : `${formatCurrency(job.salary.min, job.salary.currency)} – ${formatCurrency(job.salary.max, job.salary.currency)}`}</span><span>Hạn {formatDate(job.deadline)}</span><span className="font-bold text-slate-700">{item.applicationCount} hồ sơ</span></div></div><div className="flex shrink-0 flex-wrap gap-2"><Link className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" state={{ from: '/employer/jobs' }} to={`/jobs/${job.id}`}>Xem</Link><Link className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50" to={`/employer/jobs/${job.id}/applications`}>Hồ sơ ({item.applicationCount})</Link><Link className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50" to={`/employer/jobs/${job.id}/edit`}>Sửa</Link><button className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50" disabled={processing} onClick={() => void toggleStatus(job)} type="button">{job.status === 'open' ? 'Đóng tin' : getJobModerationStatus(job) === 'approved' ? 'Mở tin' : 'Mở & gửi duyệt'}</button><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={processing} onClick={() => void removeJob(item)} type="button">Xóa</button></div></div></article>
        })}</div>}
      </div>
    </div>
  )
}
