import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { APPLICATION_STATUS_META } from '../../constants/applicationStatus'
import { useAuth } from '../../hooks/useAuth'
import { applicationService } from '../../services/applicationService'
import { jobService } from '../../services/jobService'
import type { Application } from '../../types/application'
import type { Job } from '../../types/job'
import { formatDate } from '../../utils/formatDate'

interface ApplicationItem {
  application: Application
  job: Job
}

export function CandidateApplicationsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ApplicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!user) return

    applicationService
      .getByCandidate(user.id)
      .then(async (applications) =>
        Promise.all(
          applications.map(async (application) => ({
            application,
            job: await jobService.getById(application.jobId),
          })),
        ),
      )
      .then((data) => active && setItems(data.sort((a, b) => b.application.appliedAt.localeCompare(a.application.appliedAt))))
      .catch(() => active && setError('Không thể tải danh sách đơn ứng tuyển.'))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [user])

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">HÀNH TRÌNH ỨNG TUYỂN</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Đơn ứng tuyển của tôi</h1>
      <p className="mt-2 text-slate-500">Theo dõi trạng thái xử lý hồ sơ từ nhà tuyển dụng.</p>

      <div className="mt-7">
        {loading ? <Loading /> : error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : items.length === 0 ? <EmptyState title="Bạn chưa ứng tuyển công việc nào" description="Khám phá danh sách việc làm và gửi hồ sơ đầu tiên của bạn." /> : <div className="space-y-4">{items.map(({ application, job }) => {
          const status = APPLICATION_STATUS_META[application.status]
          return <article className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" key={application.id}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><Link className="text-xl font-black text-slate-950 hover:text-emerald-700" to={`/jobs/${job.id}`}>{job.title}</Link><p className="mt-1 font-semibold text-slate-500">{job.companyName}</p><p className="mt-3 text-sm text-slate-400">Nộp ngày {formatDate(application.appliedAt)} · CV: {application.cvUrl.split('/').pop()}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-sm font-bold ${status.className}`}>{status.label}</span></div>{application.lastNotification && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-blue-700">{application.lastNotification.channel === 'email' ? 'Email mô phỏng từ nhà tuyển dụng' : 'Thông báo từ nhà tuyển dụng'}</p><span className="text-xs text-blue-500">{formatDate(application.lastNotification.sentAt)}</span></div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-blue-900">{application.lastNotification.message}</p></div>}{application.coverLetter && <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Thư giới thiệu</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{application.coverLetter}</p></div>}<details className="mt-4 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-bold text-emerald-700">Xem lịch sử trạng thái</summary><ol className="mt-3 space-y-3">{application.statusHistory.slice().reverse().map((history) => <li className="border-l-2 border-emerald-200 pl-3 text-sm" key={`${history.status}-${history.changedAt}`}><p className="font-bold text-slate-700">{APPLICATION_STATUS_META[history.status].label}</p><p className="text-slate-500">{history.note} · {formatDate(history.changedAt)}</p></li>)}</ol></details></article>
        })}</div>}
      </div>
    </div>
  )
}
