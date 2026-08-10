import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { APPLICATION_STATUS_META } from '../../constants/applicationStatus'
import { useAuth } from '../../hooks/useAuth'
import { applicationService } from '../../services/applicationService'
import { jobService } from '../../services/jobService'
import type { Application, ApplicationStatus } from '../../types/application'
import type { Job } from '../../types/job'
import { isPublicJob } from '../../utils/jobModeration'

const APPLICATION_STATUSES: ApplicationStatus[] = [
  'pending',
  'reviewing',
  'interviewed',
  'accepted',
  'rejected',
]

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending: '#f59e0b',
  reviewing: '#3b82f6',
  interviewed: '#8b5cf6',
  accepted: '#10b981',
  rejected: '#ef4444',
}

function shortenTitle(title: string) {
  return title.length > 24 ? `${title.slice(0, 23)}…` : title
}

export function EmployerDashboardPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      if (!user) {
        if (active) setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      try {
        const ownedJobs = await jobService.getByEmployer(user.id)
        const applicationGroups = await Promise.all(
          ownedJobs.map((job) => applicationService.getByJob(job.id)),
        )
        if (!active) return

        setJobs(ownedJobs)
        setApplications(applicationGroups.flat())
      } catch {
        if (active) setError('Không thể tải số liệu Dashboard. Vui lòng thử lại sau.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [user])

  const dashboardData = useMemo(() => {
    const applicationCountByJob = new Map<string, number>()
    const statusCounts = Object.fromEntries(
      APPLICATION_STATUSES.map((status) => [status, 0]),
    ) as Record<ApplicationStatus, number>

    applications.forEach((application) => {
      applicationCountByJob.set(
        application.jobId,
        (applicationCountByJob.get(application.jobId) ?? 0) + 1,
      )
      statusCounts[application.status] += 1
    })

    const acceptedCount = statusCounts.accepted
    return {
      openJobCount: jobs.filter(isPublicJob).length,
      hiringRate:
        applications.length === 0
          ? 0
          : Math.round((acceptedCount / applications.length) * 100),
      acceptedCount,
      barData: jobs
        .map((job) => ({
          name: shortenTitle(job.title),
          fullTitle: job.title,
          applications: applicationCountByJob.get(job.id) ?? 0,
        }))
        .sort((a, b) => b.applications - a.applications),
      pieData: APPLICATION_STATUSES.map((status) => ({
        status,
        name: APPLICATION_STATUS_META[status].label,
        value: statusCounts[status],
        color: STATUS_COLORS[status],
      })),
    }
  }, [applications, jobs])

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">NHÀ TUYỂN DỤNG</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">
        {user?.companyProfile?.name ?? 'Dashboard tuyển dụng'}
      </h1>
      <p className="mt-2 text-slate-500">
        Theo dõi hiệu quả tin tuyển dụng và tình trạng hồ sơ ứng viên.
      </p>

      {loading ? (
        <Loading label="Đang tổng hợp số liệu Dashboard..." />
      ) : error ? (
        <p className="mt-7 rounded-xl bg-red-50 p-4 font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:ring-2 hover:ring-emerald-200"
              to="/employer/jobs"
            >
              <p className="text-3xl font-black text-emerald-600">{jobs.length}</p>
              <p className="mt-2 text-sm font-bold text-slate-700">Tổng tin tuyển dụng</p>
              <p className="mt-1 text-xs text-slate-400">Gồm tin mở, đã đóng và bản nháp</p>
            </Link>
            <Link
              className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:ring-2 hover:ring-blue-200"
              to="/employer/jobs"
            >
              <p className="text-3xl font-black text-blue-600">{dashboardData.openJobCount}</p>
              <p className="mt-2 text-sm font-bold text-slate-700">Tin đang mở hiệu lực</p>
              <p className="mt-1 text-xs text-slate-400">Đang tuyển và chưa hết hạn nộp</p>
            </Link>
            <Link
              className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:ring-2 hover:ring-violet-200"
              to="/employer/applications"
            >
              <p className="text-3xl font-black text-violet-600">{applications.length}</p>
              <p className="mt-2 text-sm font-bold text-slate-700">Hồ sơ ứng tuyển</p>
              <p className="mt-1 text-xs text-slate-400">Tổng hồ sơ trên tất cả tin của bạn</p>
            </Link>
            <Link
              className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:ring-2 hover:ring-amber-200"
              to="/employer/applications"
            >
              <p className="text-3xl font-black text-amber-600">{dashboardData.hiringRate}%</p>
              <p className="mt-2 text-sm font-bold text-slate-700">Tỉ lệ tuyển thành công</p>
              <p className="mt-1 text-xs text-slate-400">
                {dashboardData.acceptedCount}/{applications.length} hồ sơ đã được nhận
              </p>
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                description="Hãy đăng tin đầu tiên để bắt đầu nhận hồ sơ và theo dõi số liệu tại đây."
                title="Chưa có dữ liệu tuyển dụng"
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
              <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Hồ sơ theo từng tin</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    So sánh lượng ứng tuyển của toàn bộ tin thuộc doanh nghiệp.
                  </p>
                </div>
                <div className="mt-5 w-full overflow-x-auto">
                  <div className="min-w-[460px]">
                    <ResponsiveContainer
                      height={Math.max(320, dashboardData.barData.length * 42)}
                      width="100%"
                    >
                      <BarChart
                        data={dashboardData.barData}
                        layout="vertical"
                        margin={{ bottom: 8, left: 8, right: 24, top: 8 }}
                      >
                        <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                        <XAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} type="number" />
                        <YAxis
                          dataKey="name"
                          tick={{ fill: '#475569', fontSize: 12 }}
                          type="category"
                          width={155}
                        />
                        <Tooltip
                          cursor={{ fill: '#f1f5f9' }}
                          formatter={(value) => [`${Number(value).toLocaleString('vi-VN')} hồ sơ`, 'Ứng tuyển']}
                          labelFormatter={(label) =>
                            dashboardData.barData.find((item) => item.name === label)?.fullTitle ?? label
                          }
                        />
                        <Bar dataKey="applications" fill="#10b981" name="Ứng tuyển" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-black text-slate-950">Tỉ lệ trạng thái hồ sơ</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Phân bổ {applications.length} hồ sơ theo trạng thái hiện tại.
                </p>
                {applications.length === 0 ? (
                  <div className="grid min-h-80 place-items-center text-center text-sm text-slate-500">
                    Chưa có hồ sơ để hiển thị biểu đồ trạng thái.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 h-72 w-full">
                      <ResponsiveContainer height="100%" width="100%">
                        <PieChart>
                          <Pie
                            cx="50%"
                            cy="45%"
                            data={dashboardData.pieData}
                            dataKey="value"
                            innerRadius={55}
                            nameKey="name"
                            outerRadius={92}
                            paddingAngle={2}
                          >
                            {dashboardData.pieData.map((entry) => (
                              <Cell fill={entry.color} key={entry.status} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              `${Number(value).toLocaleString('vi-VN')} hồ sơ`,
                              'Số lượng',
                            ]}
                          />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                      {dashboardData.pieData.map((item) => (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2" key={item.status}>
                          <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="min-w-0 truncate text-xs font-semibold text-slate-600">
                            {item.name}
                          </span>
                          <span className="ml-auto text-sm font-black text-slate-900">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}

      <div className="mt-6 rounded-2xl bg-slate-950 p-6 text-white">
        <h2 className="text-xl font-black">Tìm ứng viên phù hợp</h2>
        <p className="mt-2 text-sm text-slate-300">
          Đăng tin tuyển dụng mới để tiếp cận ứng viên trên JobHub.
        </p>
        <Link
          className="mt-5 inline-block rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-400"
          to="/employer/jobs/create"
        >
          + Đăng tin mới
        </Link>
      </div>
    </div>
  )
}
