import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Job } from '../../types/job'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'

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

export function JobCard({ job, action }: { job: Job; action?: ReactNode }) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <div className="flex gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-emerald-50 text-lg font-black text-emerald-700">
          {job.companyName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <Link className="text-lg font-bold text-slate-900 group-hover:text-emerald-700" to={`/jobs/${job.id}`}>
            {job.title}
          </Link>
          <Link className="mt-1 block truncate text-sm font-medium text-slate-500 hover:text-emerald-700 hover:underline" to={`/companies/${job.employerId}`}>{job.companyName}</Link>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1.5">{job.location}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5">{employmentLabels[job.employmentType]}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5">{workplaceLabels[job.workplaceType]}</span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs text-slate-400">Mức lương</p>
          <p className="mt-1 font-bold text-emerald-700">
            {job.salary.negotiable
              ? 'Thỏa thuận'
              : `${formatCurrency(job.salary.min, job.salary.currency)} – ${formatCurrency(job.salary.max, job.salary.currency)}`}
          </p>
        </div>
        <p className="text-right text-xs text-slate-400">Hạn {formatDate(job.deadline)}</p>
      </div>
    </article>
  )
}
