import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmployerApplicationDetail } from '../../components/applications/EmployerApplicationDetail'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { Pagination } from '../../components/common/Pagination'
import { APPLICATION_STATUS_META } from '../../constants/applicationStatus'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { applicationService } from '../../services/applicationService'
import { jobService } from '../../services/jobService'
import { userService } from '../../services/userService'
import type { Application, ApplicationNotification, ApplicationStatus } from '../../types/application'
import type { Job } from '../../types/job'
import type { User } from '../../types/user'
import { formatDate } from '../../utils/formatDate'

interface EmployerApplicationItem {
  application: Application
  candidate: User
  job: Job
}

const statuses: ApplicationStatus[] = ['pending', 'reviewing', 'interviewed', 'accepted', 'rejected']
const PAGE_SIZE = 12

export function EmployerApplicationsPage() {
  const { jobId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState<EmployerApplicationItem[]>([])
  const [ownedJobs, setOwnedJobs] = useState<Job[]>([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('')
  const [jobFilter, setJobFilter] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [sendingId, setSendingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let active = true
    if (!user) return

    const loadApplications = async () => {
      try {
        const jobs = await jobService.getByEmployer(user.id)
        let jobsToLoad = jobs

        if (jobId) {
          const requestedJob = await jobService.getById(jobId)
          if (requestedJob.employerId !== user.id) {
            if (active) navigate('/forbidden', { replace: true })
            return
          }
          jobsToLoad = [requestedJob]
        }

        const [users, applicationGroups] = await Promise.all([
          userService.getAll(),
          Promise.all(jobsToLoad.map((job) => applicationService.getByJob(job.id))),
        ])
        if (!active) return

        const candidateMap = new Map(users.map((candidate) => [candidate.id, candidate]))
        const jobMap = new Map(jobsToLoad.map((job) => [job.id, job]))
        const data = applicationGroups
          .flat()
          .map((application) => ({
            application,
            candidate: candidateMap.get(application.candidateId),
            job: jobMap.get(application.jobId),
          }))
          .filter((item): item is EmployerApplicationItem => Boolean(item.candidate && item.job))

        setOwnedJobs(jobs)
        setItems(
          data.sort((a, b) =>
            b.application.appliedAt.localeCompare(a.application.appliedAt),
          ),
        )
      } catch {
        if (active) {
          setError(jobId ? 'Không tìm thấy tin tuyển dụng hoặc không thể tải hồ sơ.' : 'Không thể tải danh sách hồ sơ ứng tuyển.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadApplications()

    return () => {
      active = false
    }
  }, [jobId, navigate, user])

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    return items.filter(({ application, candidate, job }) => {
      const matchesKeyword =
        !normalizedKeyword ||
        candidate.fullName.toLocaleLowerCase('vi').includes(normalizedKeyword) ||
        candidate.email.toLocaleLowerCase('vi').includes(normalizedKeyword) ||
        job.title.toLocaleLowerCase('vi').includes(normalizedKeyword)
      return (
        matchesKeyword &&
        (!statusFilter || application.status === statusFilter) &&
        (!jobFilter || application.jobId === jobFilter)
      )
    })
  }, [items, jobFilter, keyword, statusFilter])

  const statusCounts = useMemo(
    () => Object.fromEntries(statuses.map((status) => [status, items.filter(({ application }) => application.status === status).length])) as Record<ApplicationStatus, number>,
    [items],
  )
  const selectedItem = items.find(({ application }) => application.id === selectedId) ?? null
  const requestedJob = jobId ? ownedJobs.find((job) => job.id === jobId) : null
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const firstResult = filteredItems.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastResult = Math.min(currentPage * PAGE_SIZE, filteredItems.length)

  const updateStatus = async (applicationId: string, status: ApplicationStatus, note: string) => {
    if (!user) return false
    setUpdatingId(applicationId)
    try {
      const updatedApplication = await applicationService.updateStatusOwned(
        applicationId,
        status,
        user.id,
        note,
      )
      setItems((current) => current.map((item) =>
        item.application.id === applicationId ? { ...item, application: updatedApplication } : item,
      ))
      setCurrentPage(1)
      showToast(`Đã chuyển hồ sơ sang “${APPLICATION_STATUS_META[status].label}”.`, 'success')
      return true
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'Không thể cập nhật trạng thái hồ sơ.', 'error')
      return false
    } finally {
      setUpdatingId('')
    }
  }

  const sendNotification = async (applicationId: string, channel: ApplicationNotification['channel'], message: string) => {
    if (!user) return false
    setSendingId(applicationId)
    try {
      const updatedApplication = await applicationService.sendNotificationOwned(
        applicationId,
        user.id,
        channel,
        message,
      )
      setItems((current) => current.map((item) =>
        item.application.id === applicationId ? { ...item, application: updatedApplication } : item,
      ))
      showToast(channel === 'email' ? 'Đã lưu email mô phỏng. Email không được gửi ra ngoài.' : 'Đã gửi thông báo trong ứng dụng.', 'success')
      return true
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'Không thể gửi thông báo.', 'error')
      return false
    } finally {
      setSendingId('')
    }
  }

  return (
    <div>
      {jobId && <Link className="text-sm font-bold text-emerald-700" to="/employer/jobs">← Quay lại tin tuyển dụng</Link>}
      <div className={jobId ? 'mt-5' : ''}><p className="text-sm font-bold text-emerald-600">QUẢN LÝ ỨNG VIÊN</p><h1 className="mt-1 text-3xl font-black text-slate-950">{requestedJob ? `Hồ sơ: ${requestedJob.title}` : 'Tất cả hồ sơ ứng tuyển'}</h1><p className="mt-2 text-slate-500">Xem thông tin, cập nhật trạng thái và gửi thông báo mô phỏng cho ứng viên.</p></div>

      {!loading && !error && <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">{statuses.map((status) => <button className={`rounded-2xl p-4 text-left shadow-sm ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 hover:ring-2 hover:ring-emerald-200'}`} key={status} onClick={() => { setStatusFilter((current) => current === status ? '' : status); setCurrentPage(1) }} type="button"><p className={`text-2xl font-black ${statusFilter === status ? 'text-emerald-400' : 'text-emerald-600'}`}>{statusCounts[status]}</p><p className={`mt-1 text-xs font-bold ${statusFilter === status ? 'text-slate-300' : 'text-slate-500'}`}>{APPLICATION_STATUS_META[status].label}</p></button>)}</div>}

      {!loading && !error && <div className={`mt-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ${jobId ? 'sm:grid-cols-[1fr_190px]' : 'sm:grid-cols-[1fr_220px_190px]'}`}><input aria-label="Tìm ứng viên" className="field" onChange={(event) => { setKeyword(event.target.value); setCurrentPage(1) }} placeholder="Tên, email, vị trí ứng tuyển..." value={keyword} />{!jobId && <select aria-label="Lọc theo tin" className="field" onChange={(event) => { setJobFilter(event.target.value); setCurrentPage(1) }} value={jobFilter}><option value="">Mọi tin tuyển dụng</option>{ownedJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>}<select aria-label="Lọc trạng thái" className="field" onChange={(event) => { setStatusFilter(event.target.value as ApplicationStatus | ''); setCurrentPage(1) }} value={statusFilter}><option value="">Mọi trạng thái</option>{statuses.map((status) => <option key={status} value={status}>{APPLICATION_STATUS_META[status].label}</option>)}</select></div>}

      <div className="mt-6">{loading ? <Loading label="Đang tải hồ sơ ứng tuyển..." /> : error ? <p className="rounded-xl bg-red-50 p-4 font-semibold text-red-700">{error}</p> : filteredItems.length === 0 ? <EmptyState title="Không có hồ sơ phù hợp" description="Chưa có ứng viên hoặc không có kết quả phù hợp với bộ lọc." /> : <><p className="mb-4 text-sm text-slate-500">Đang hiển thị {firstResult}–{lastResult} trong {filteredItems.length} hồ sơ</p><div className="space-y-4">{paginatedItems.map(({ application, candidate, job }) => {
        const status = APPLICATION_STATUS_META[application.status]
        return <article className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" key={application.id}><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex min-w-0 gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700">{candidate.fullName.charAt(0)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-black text-slate-950">{candidate.fullName}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></div><p className="mt-1 text-sm font-semibold text-slate-500">{job.title}</p><p className="mt-2 text-xs text-slate-400">{candidate.email} · Nộp ngày {formatDate(application.appliedAt)}</p>{candidate.candidateProfile?.skills.length ? <div className="mt-3 flex flex-wrap gap-2">{candidate.candidateProfile.skills.slice(0, 4).map((skill) => <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600" key={skill}>{skill}</span>)}</div> : null}</div></div><button className="w-fit shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700" onClick={() => setSelectedId(application.id)} type="button">Xem chi tiết</button></div></article>
      })}</div><Pagination currentPage={currentPage} onPageChange={setCurrentPage} totalPages={totalPages} /></>}</div>

      {selectedItem && <EmployerApplicationDetail application={selectedItem.application} candidate={selectedItem.candidate} job={selectedItem.job} key={selectedItem.application.id} onClose={() => setSelectedId('')} onSendNotification={(channel, message) => sendNotification(selectedItem.application.id, channel, message)} onStatusChange={(status, note) => updateStatus(selectedItem.application.id, status, note)} sending={sendingId === selectedItem.application.id} updating={updatingId === selectedItem.application.id} />}
    </div>
  )
}
