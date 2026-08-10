import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Loading } from '../../components/common/Loading'
import { APPLICATION_STATUS_META } from '../../constants/applicationStatus'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { applicationService } from '../../services/applicationService'
import { bookmarkService } from '../../services/bookmarkService'
import { jobService } from '../../services/jobService'
import type { Application } from '../../types/application'
import type { Bookmark } from '../../types/bookmark'
import type { Job } from '../../types/job'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'
import { getJobModerationStatus, isPublicJob } from '../../utils/jobModeration'
import { isJobExpired } from '../../utils/isJobExpired'

const employmentLabels = {
  'full-time': 'Toàn thời gian',
  'part-time': 'Bán thời gian',
  contract: 'Hợp đồng',
  internship: 'Thực tập',
}

const workplaceLabels = {
  'on-site': 'Tại văn phòng',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

const moderationLabels = {
  unsubmitted: 'Chưa gửi duyệt',
  pending: 'Chờ Admin duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  hidden: 'Đã bị ẩn',
}

export function JobDetailPage() {
  const { jobId = '' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [cvUrl, setCvUrl] = useState(user?.candidateProfile?.cvUrl ?? '')
  const [application, setApplication] = useState<Application | null>(null)
  const [bookmark, setBookmark] = useState<Bookmark | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingBookmark, setTogglingBookmark] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    jobService
      .getById(jobId)
      .then(setJob)
      .catch(() => setError('Không tìm thấy tin tuyển dụng.'))
      .finally(() => setLoading(false))
  }, [jobId])

  useEffect(() => {
    let active = true
    if (user?.role !== 'candidate') return

    Promise.all([
      applicationService.getByCandidateAndJob(user.id, jobId),
      bookmarkService.getByCandidateAndJob(user.id, jobId),
    ])
      .then(([applications, bookmarks]) => {
        if (!active) return
        setApplication(applications[0] ?? null)
        setBookmark(bookmarks[0] ?? null)
      })
      .catch(() => {
        if (active) showToast('Không thể tải trạng thái ứng tuyển và lưu việc.', 'error', 3000)
      })

    return () => {
      active = false
    }
  }, [jobId, showToast, user])

  const handleCvChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if ((file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) || file.size > 5 * 1024 * 1024) {
      setActionError('CV phải là file PDF và không vượt quá 5 MB.')
      event.target.value = ''
      return
    }
    setCvUrl(`/cvs/${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`)
    setActionError('')
  }

  const handleApply = async (event: FormEvent) => {
    event.preventDefault()
    if (!job || user?.role !== 'candidate') return
    if (!isPublicJob(job)) {
      setActionError('Tin tuyển dụng chưa được duyệt, đã đóng hoặc đã hết hạn.')
      return
    }
    if (!cvUrl) {
      setActionError('Vui lòng chọn CV PDF trước khi ứng tuyển.')
      return
    }

    setSubmitting(true)
    setActionError('')
    try {
      const createdApplication = await applicationService.create({
        jobId: job.id,
        candidateId: user.id,
        cvUrl,
        coverLetter: coverLetter.trim(),
      })
      setApplication(createdApplication)
      setShowApplicationForm(false)
      showToast('Ứng tuyển thành công. Bạn có thể theo dõi hồ sơ trong mục Đơn ứng tuyển.', 'success', 2500)
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : 'Không thể gửi hồ sơ ứng tuyển.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleBookmark = async () => {
    if (!job || user?.role !== 'candidate') return
    setTogglingBookmark(true)
    setActionError('')
    try {
      if (bookmark) {
        await bookmarkService.remove(bookmark.id)
        setBookmark(null)
        showToast('Đã bỏ công việc khỏi danh sách đã lưu.', 'success')
      } else {
        const createdBookmark = await bookmarkService.create(user.id, job.id)
        setBookmark(createdBookmark)
        showToast('Đã lưu công việc vào danh sách của bạn.', 'success')
      }
    } catch (bookmarkError) {
      showToast(
        bookmarkError instanceof Error
          ? bookmarkError.message
          : 'Không thể cập nhật danh sách việc làm đã lưu.',
        'error',
        3000,
      )
    } finally {
      setTogglingBookmark(false)
    }
  }

  if (loading) return <Loading />
  if (error || !job) return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-red-700">{error}</div>

  const moderationStatus = getJobModerationStatus(job)
  const expired = isJobExpired(job.deadline)
  const unavailable = !isPublicJob(job)
  const requestedBackPath = (location.state as { from?: unknown } | null)?.from
  const companyPath = `/companies/${job.employerId}`
  const openedFromCompany = requestedBackPath === companyPath
  const openedFromEmployer =
    user?.role === 'employer' &&
    requestedBackPath === '/employer/jobs'
  const openedFromNotifications =
    user?.role === 'candidate' &&
    requestedBackPath === '/candidate/notifications'
  const openedFromAdmin =
    user?.role === 'admin' && requestedBackPath === '/admin/jobs'
  const backPath = openedFromAdmin
    ? '/admin/jobs'
    : openedFromNotifications
    ? '/candidate/notifications'
    : openedFromCompany
    ? companyPath
    : openedFromEmployer
      ? '/employer/jobs'
      : '/jobs'
  const backLabel = openedFromAdmin
    ? 'Quay lại kiểm duyệt tin'
    : openedFromNotifications
    ? 'Quay lại thông báo'
    : openedFromCompany
    ? `Quay lại ${job.companyName}`
    : openedFromEmployer
      ? 'Quay lại quản lý tin tuyển dụng'
      : 'Quay lại danh sách việc làm'
  const canPreviewUnapproved =
    user?.role === 'admin' ||
    (user?.role === 'employer' && user.id === job.employerId)

  if (moderationStatus !== 'approved' && !canPreviewUnapproved) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-black text-slate-950">Tin tuyển dụng chưa khả dụng</h1>
        <p className="mt-3 text-slate-500">
          Tin này đang chờ kiểm duyệt, đã bị từ chối hoặc đã được Admin ẩn.
        </p>
        <Link className="mt-6 inline-block font-bold text-emerald-700" to={backPath}>
          ← {backLabel}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="text-sm font-semibold text-emerald-700" to={backPath}>← {backLabel}</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex gap-5 border-b border-slate-100 pb-7">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-2xl font-black text-emerald-700">{job.companyName.charAt(0)}</div>
            <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black text-slate-950">{job.title}</h1>{moderationStatus !== 'approved' ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{moderationLabels[moderationStatus]}</span> : unavailable && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">{expired ? 'Đã hết hạn' : 'Đã đóng'}</span>}</div><Link className="mt-2 inline-block font-semibold text-slate-500 hover:text-emerald-700 hover:underline" state={{ from: `/jobs/${job.id}` }} to={`/companies/${job.employerId}`}>{job.companyName} · Xem thông tin và đánh giá</Link></div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 py-5 text-sm font-semibold text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-1.5">{employmentLabels[job.employmentType]}</span><span className="rounded-full bg-slate-100 px-3 py-1.5">{workplaceLabels[job.workplaceType]}</span>{job.skills.map((skill) => <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700" key={skill}>{skill}</span>)}</div>
          <section className="py-7"><h2 className="section-title">Mô tả công việc</h2><p className="mt-4 whitespace-pre-line leading-7 text-slate-600">{job.description}</p></section>
          <section className="border-t border-slate-100 py-7"><h2 className="section-title">Yêu cầu</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600">{job.requirements.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section className="border-t border-slate-100 pt-7"><h2 className="section-title">Quyền lợi</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600">{job.benefits.map((item) => <li key={item}>{item}</li>)}</ul></section>
        </article>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm text-slate-500">Mức lương</p><p className="mt-1 text-xl font-black text-emerald-700">{job.salary.negotiable ? 'Thỏa thuận' : `${formatCurrency(job.salary.min, job.salary.currency)} – ${formatCurrency(job.salary.max, job.salary.currency)}`}</p>
          <dl className="mt-6 space-y-4 text-sm"><div><dt className="text-slate-400">Địa điểm</dt><dd className="mt-1 font-semibold">{job.location}</dd></div><div><dt className="text-slate-400">Hạn nộp</dt><dd className="mt-1 font-semibold">{formatDate(job.deadline)}</dd></div><div><dt className="text-slate-400">Ngành nghề</dt><dd className="mt-1 font-semibold">{job.category}</dd></div></dl>
          {moderationStatus !== 'approved' && canPreviewUnapproved && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-black">{moderationLabels[moderationStatus]}</p>{job.moderationReason && <p className="mt-1">Lý do: {job.moderationReason}</p>}</div>}
          {user?.role === 'candidate' ? <div className="mt-7 space-y-3">{application ? <div className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">Đã ứng tuyển · {APPLICATION_STATUS_META[application.status].label}</div> : <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300" disabled={unavailable} onClick={() => { setActionError(''); setShowApplicationForm(true) }} type="button">{unavailable ? 'Không còn nhận hồ sơ' : 'Ứng tuyển ngay'}</button>}<button className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={togglingBookmark || (unavailable && !bookmark)} onClick={() => void toggleBookmark()} type="button">{togglingBookmark ? 'Đang cập nhật...' : bookmark ? '★ Đã lưu việc làm' : '☆ Lưu việc làm'}</button></div> : user ? <p className="mt-7 rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold text-slate-600">{user.role === 'admin' ? 'Bạn đang xem trước tin với quyền Admin.' : 'Chỉ tài khoản ứng viên mới có thể ứng tuyển.'}</p> : unavailable ? <p className="mt-7 rounded-xl bg-red-50 p-3 text-center text-sm font-semibold text-red-700">Tin tuyển dụng không còn nhận hồ sơ.</p> : <Link className="mt-7 block rounded-xl bg-emerald-600 px-4 py-3 text-center font-bold text-white hover:bg-emerald-700" state={{ from: `/jobs/${job.id}` }} to="/login">Đăng nhập để ứng tuyển</Link>}
        </aside>
      </div>

      {showApplicationForm && <div aria-labelledby="application-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog"><div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-emerald-600">ỨNG TUYỂN</p><h2 className="mt-1 text-2xl font-black text-slate-950" id="application-title">{job.title}</h2></div><button aria-label="Đóng" className="rounded-lg p-2 text-xl text-slate-400 hover:bg-slate-100" onClick={() => setShowApplicationForm(false)} type="button">×</button></div><form className="mt-6 space-y-5" onSubmit={handleApply}><div><label className="label" htmlFor="application-cv">CV PDF</label><input accept="application/pdf,.pdf" className="mt-2 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2.5 file:font-bold file:text-emerald-700" id="application-cv" onChange={handleCvChange} type="file" />{cvUrl && <p className="mt-2 text-sm font-semibold text-emerald-700">Đang dùng: {cvUrl.split('/').pop()}</p>}</div><label className="block"><span className="label">Thư giới thiệu</span><textarea className="field mt-2 min-h-36 resize-y" maxLength={2000} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Giới thiệu ngắn gọn vì sao bạn phù hợp với vị trí này..." required value={coverLetter} /></label>{actionError && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{actionError}</p>}<div className="flex justify-end gap-3"><button className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700" onClick={() => setShowApplicationForm(false)} type="button">Hủy</button><button className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Đang gửi...' : 'Gửi hồ sơ'}</button></div></form></div></div>}
    </div>
  )
}
