import { useEffect, useMemo, useState } from 'react'
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
import { Loading } from '../../components/common/Loading'
import { APPLICATION_STATUS_META } from '../../constants/applicationStatus'
import { applicationService } from '../../services/applicationService'
import { jobService } from '../../services/jobService'
import { userService } from '../../services/userService'
import type { Application, ApplicationStatus } from '../../types/application'
import type { Job, JobStatus } from '../../types/job'
import type { User } from '../../types/user'

interface AdminDashboardData {
  users: User[]
  jobs: Job[]
  applications: Application[]
}

const applicationStatuses: ApplicationStatus[] = [
  'pending',
  'reviewing',
  'interviewed',
  'accepted',
  'rejected',
]

const applicationStatusColors: Record<ApplicationStatus, string> = {
  pending: '#f59e0b',
  reviewing: '#3b82f6',
  interviewed: '#8b5cf6',
  accepted: '#10b981',
  rejected: '#ef4444',
}

const jobStatusMeta: Record<JobStatus, { label: string; className: string }> = {
  open: { label: 'Đang tuyển', className: 'bg-emerald-50 text-emerald-700' },
  closed: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-700' },
  draft: { label: 'Bản nháp', className: 'bg-amber-50 text-amber-700' },
}

const numberFormatter = new Intl.NumberFormat('vi-VN')

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      setError('')

      try {
        const [users, jobs, applications] = await Promise.all([
          userService.getAll(),
          jobService.getAllForAdmin(),
          applicationService.getAll(),
        ])

        if (active) setData({ users, jobs, applications })
      } catch {
        if (active) {
          setData(null)
          setError('Không thể tải dữ liệu thống kê. Hãy kiểm tra JSON Server và thử lại.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [reloadToken])

  const dashboard = useMemo(() => {
    if (!data) return null

    const candidateCount = data.users.filter((user) => user.role === 'candidate').length
    const employerCount = data.users.filter((user) => user.role === 'employer').length

    const jobsByCategory = new Map<string, number>()
    data.jobs.forEach((job) => {
      jobsByCategory.set(job.category, (jobsByCategory.get(job.category) ?? 0) + 1)
    })

    const categoryChartData = [...jobsByCategory.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((first, second) => second.value - first.value)

    const jobsByLocation = new Map<string, number>()
    data.jobs.forEach((job) => {
      const location = job.location.trim() || 'Chưa cập nhật'
      jobsByLocation.set(location, (jobsByLocation.get(location) ?? 0) + 1)
    })

    const locationChartData = [...jobsByLocation.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((first, second) =>
        second.value - first.value || first.name.localeCompare(second.name, 'vi'),
      )

    const applicationStatusChartData = applicationStatuses.map((status) => ({
      key: status,
      name: APPLICATION_STATUS_META[status].label,
      value: data.applications.filter((application) => application.status === status).length,
      fill: applicationStatusColors[status],
    }))

    const jobStatusCounts = Object.fromEntries(
      (['open', 'closed', 'draft'] as JobStatus[]).map((status) => [
        status,
        data.jobs.filter((job) => job.status === status).length,
      ]),
    ) as Record<JobStatus, number>

    return {
      candidateCount,
      employerCount,
      categoryChartData,
      locationChartData,
      applicationStatusChartData,
      jobStatusCounts,
    }
  }, [data])

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">QUẢN TRỊ HỆ THỐNG</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Tổng quan JobHub</h1>
      <p className="mt-2 text-slate-500">
        Theo dõi quy mô tuyển dụng và tình trạng xử lý hồ sơ trên toàn hệ thống.
      </p>

      {loading ? (
        <div className="mt-8">
          <Loading label="Đang tổng hợp số liệu hệ thống..." />
        </div>
      ) : error || !data || !dashboard ? (
        <div className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="font-semibold text-red-700">{error || 'Không có dữ liệu để hiển thị.'}</p>
          <button
            className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            onClick={() => setReloadToken((current) => current + 1)}
            type="button"
          >
            Thử tải lại
          </button>
        </div>
      ) : (
        <>
          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số tổng quan">
            {[
              { value: data.jobs.length, label: 'Tin tuyển dụng', description: 'Tất cả trạng thái' },
              { value: dashboard.candidateCount, label: 'Ứng viên', description: 'Tài khoản Candidate' },
              { value: dashboard.employerCount, label: 'Doanh nghiệp', description: 'Tài khoản Employer' },
              { value: data.applications.length, label: 'Hồ sơ ứng tuyển', description: 'Đã gửi trên hệ thống' },
            ].map((item) => (
              <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" key={item.label}>
                <p className="text-3xl font-black text-emerald-600">
                  {numberFormatter.format(item.value)}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-700">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{item.description}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <article className="min-w-0 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Tin tuyển dụng</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Phân bổ theo ngành nghề</h2>
                  <p className="mt-1 text-sm text-slate-500">Số lượng tin ở từng nhóm ngành trên JobHub.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(jobStatusMeta) as JobStatus[]).map((status) => (
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${jobStatusMeta[status].className}`} key={status}>
                      {jobStatusMeta[status].label}: {numberFormatter.format(dashboard.jobStatusCounts[status])}
                    </span>
                  ))}
                </div>
              </div>

              {dashboard.categoryChartData.length === 0 ? (
                <p className="mt-8 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                  Chưa có tin tuyển dụng để thống kê.
                </p>
              ) : (
                <div className="mt-6 h-[410px] w-full" role="img" aria-label="Biểu đồ số tin tuyển dụng theo ngành nghề">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboard.categoryChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis allowDecimals={false} axisLine={false} tickLine={false} type="number" />
                      <YAxis
                        axisLine={false}
                        dataKey="name"
                        tick={{ fill: '#475569', fontSize: 12 }}
                        tickLine={false}
                        type="category"
                        width={142}
                      />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="value" fill="#10b981" name="Số tin" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>

            <article className="min-w-0 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Hồ sơ ứng tuyển</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Tỷ lệ theo trạng thái</h2>
              <p className="mt-1 text-sm text-slate-500">Toàn bộ hồ sơ đang được xử lý trên hệ thống.</p>

              {data.applications.length === 0 ? (
                <p className="mt-8 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                  Chưa có hồ sơ ứng tuyển để thống kê.
                </p>
              ) : (
                <>
                  <div className="mt-4 h-[310px] w-full" role="img" aria-label="Biểu đồ tỷ lệ trạng thái hồ sơ ứng tuyển">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboard.applicationStatusChartData}
                          dataKey="value"
                          innerRadius={62}
                          nameKey="name"
                          outerRadius={100}
                          paddingAngle={2}
                        >
                          {dashboard.applicationStatusChartData.map((entry) => (
                            <Cell fill={entry.fill} key={entry.key} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {dashboard.applicationStatusChartData.map((entry) => (
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5" key={entry.key}>
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <span className="text-xs font-semibold text-slate-500">{entry.name}</span>
                        </div>
                        <p className="mt-1 text-lg font-black text-slate-900">{numberFormatter.format(entry.value)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>
          </section>

          <article className="mt-6 min-w-0 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Thị trường tuyển dụng</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Phân bổ việc làm theo địa điểm</h2>
                <p className="mt-1 text-sm text-slate-500">Thống kê toàn bộ tin tuyển dụng tại từng khu vực.</p>
              </div>
              <div className="w-fit rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">
                Tổng cộng {numberFormatter.format(data.jobs.length)} tin
              </div>
            </div>

            {dashboard.locationChartData.length === 0 ? (
              <p className="mt-8 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                Chưa có dữ liệu địa điểm để thống kê.
              </p>
            ) : (
              <div className="mt-6 h-[360px] w-full" role="img" aria-label="Biểu đồ số tin tuyển dụng theo địa điểm">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboard.locationChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis allowDecimals={false} axisLine={false} tickLine={false} type="number" />
                    <YAxis
                      axisLine={false}
                      dataKey="name"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      tickLine={false}
                      type="category"
                      width={118}
                    />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" fill="#0f766e" name="Số tin" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

          <p className="mt-4 text-right text-xs text-slate-400">
            Dữ liệu được tổng hợp trực tiếp từ JSON Server.
          </p>
        </>
      )}
    </div>
  )
}
