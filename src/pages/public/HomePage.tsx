import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { applicationService } from '../../services/applicationService'
import { bookmarkService } from '../../services/bookmarkService'
import { jobService } from '../../services/jobService'
import { userService } from '../../services/userService'
import { calculateProfileCompletion } from '../../utils/calculateProfileCompletion'

interface GlobalStats {
  openJobs: number | null
  employers: number | null
  candidates: number | null
}

interface RoleStats {
  jobs: number
  applications: number
  bookmarks: number
}

function StatValue({ value }: { value: number | null }) {
  return <>{value === null ? '…' : value.toLocaleString('vi-VN')}</>
}

function HeroCard({ eyebrow, value, description, accent = false }: { eyebrow: string; value: ReactNode; description: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl p-6 ${accent ? 'bg-emerald-500 text-slate-950' : 'border border-white/10 bg-white/10 text-white backdrop-blur'}`}>
      <p className={`text-sm font-semibold ${accent ? 'text-emerald-950/70' : 'text-slate-300'}`}>{eyebrow}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className={`mt-5 text-sm leading-6 ${accent ? 'text-emerald-950/80' : 'text-slate-300'}`}>{description}</p>
    </div>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const [globalStats, setGlobalStats] = useState<GlobalStats>({ openJobs: null, employers: null, candidates: null })
  const [roleStats, setRoleStats] = useState<RoleStats>({ jobs: 0, applications: 0, bookmarks: 0 })

  useEffect(() => {
    let active = true
    Promise.all([jobService.getAll(), userService.getAll()])
      .then(([jobs, users]) => {
        if (!active) return
        setGlobalStats({
          openJobs: jobs.length,
          employers: users.filter((item) => item.role === 'employer').length,
          candidates: users.filter((item) => item.role === 'candidate').length,
        })
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    if (user?.role === 'candidate') {
      Promise.all([
        applicationService.getByCandidate(user.id),
        bookmarkService.getByCandidate(user.id),
      ]).then(([applications, bookmarks]) => {
        if (active) setRoleStats({ jobs: 0, applications: applications.length, bookmarks: bookmarks.length })
      }).catch(() => undefined)
    } else if (user?.role === 'employer') {
      jobService.getByEmployer(user.id).then(async (jobs) => {
        const applicationGroups = await Promise.all(jobs.map((job) => applicationService.getByJob(job.id)))
        return {
          jobs: jobs.length,
          applications: applicationGroups.flat().length,
        }
      }).then((stats) => {
        if (active) setRoleStats({ ...stats, bookmarks: 0 })
      }).catch(() => undefined)
    }

    return () => {
      active = false
    }
  }, [user])

  const profileCompletion = calculateProfileCompletion(user)
  const isCandidate = user?.role === 'candidate'
  const isEmployer = user?.role === 'employer'
  const isAdmin = user?.role === 'admin'

  return (
    <>
      <section className="overflow-hidden bg-slate-950 text-white">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div className="absolute -right-32 -top-32 size-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative">
            <p className="mb-5 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">Nền tảng tuyển dụng dành cho thế hệ mới</p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              {isEmployer ? <>Kết nối đúng người cho <span className="text-emerald-400">đúng vị trí.</span></> : isAdmin ? <>Điều hành JobHub từ <span className="text-emerald-400">một nơi duy nhất.</span></> : <>Công việc phù hợp đang chờ <span className="text-emerald-400">bạn khám phá.</span></>}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">{isEmployer ? `Chào ${user.companyProfile?.name || user.fullName}. Đăng tin và theo dõi hành trình tuyển dụng của doanh nghiệp.` : isAdmin ? 'Theo dõi dữ liệu người dùng, doanh nghiệp và tin tuyển dụng trên hệ thống.' : 'Tìm kiếm cơ hội, kết nối doanh nghiệp và quản lý hành trình ứng tuyển của bạn tại một nơi.'}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isEmployer ? <><Link className="rounded-xl bg-emerald-500 px-6 py-3.5 font-bold text-slate-950 hover:bg-emerald-400" to="/employer/jobs/create">Đăng tin tuyển dụng</Link><Link className="rounded-xl border border-slate-700 px-6 py-3.5 font-bold hover:border-slate-500 hover:bg-slate-900" to="/employer/jobs">Quản lý tin</Link></> : isAdmin ? <><Link className="rounded-xl bg-emerald-500 px-6 py-3.5 font-bold text-slate-950 hover:bg-emerald-400" to="/admin">Tới Dashboard</Link><Link className="rounded-xl border border-slate-700 px-6 py-3.5 font-bold hover:border-slate-500 hover:bg-slate-900" to="/jobs">Xem việc làm</Link></> : isCandidate ? <><Link className="rounded-xl bg-emerald-500 px-6 py-3.5 font-bold text-slate-950 hover:bg-emerald-400" to="/jobs">Khám phá việc làm</Link><Link className="rounded-xl border border-slate-700 px-6 py-3.5 font-bold hover:border-slate-500 hover:bg-slate-900" to="/candidate/profile">Hồ sơ của tôi</Link></> : <><Link className="rounded-xl bg-emerald-500 px-6 py-3.5 font-bold text-slate-950 hover:bg-emerald-400" to="/jobs">Tìm việc làm</Link><Link className="rounded-xl border border-slate-700 px-6 py-3.5 font-bold hover:border-slate-500 hover:bg-slate-900" to="/register">Đăng ký tài khoản</Link></>}
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-4">
            {isEmployer ? <><HeroCard description="Các vị trí còn hạn và đang nhận hồ sơ." eyebrow="Tin đang tuyển" value={roleStats.jobs} /><HeroCard accent description="Tổng hồ sơ gửi tới các tin của doanh nghiệp." eyebrow="Hồ sơ đã nhận" value={roleStats.applications} /></> : isCandidate ? <><HeroCard description={`${roleStats.bookmarks} việc làm đang được bạn lưu lại.`} eyebrow="Đơn đã ứng tuyển" value={roleStats.applications} /><HeroCard accent description="Hoàn thiện thông tin để tăng cơ hội được chú ý." eyebrow="Hồ sơ của bạn" value={`${profileCompletion}%`} /></> : isAdmin ? <><HeroCard description="Tài khoản ứng viên trên hệ thống." eyebrow="Ứng viên" value={<StatValue value={globalStats.candidates} />} /><HeroCard accent description="Doanh nghiệp đang có tài khoản JobHub." eyebrow="Doanh nghiệp" value={<StatValue value={globalStats.employers} />} /></> : <><HeroCard description="Tìm kiếm và theo dõi hành trình ứng tuyển." eyebrow="Dành cho ứng viên" value="Tìm việc" /><HeroCard accent description="Đăng tin và tiếp cận ứng viên phù hợp." eyebrow="Dành cho doanh nghiệp" value="Tuyển người" /></>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {[{ value: globalStats.openJobs, label: 'Việc làm đang mở' }, { value: globalStats.employers, label: 'Doanh nghiệp tham gia' }, { value: globalStats.candidates, label: 'Ứng viên trên hệ thống' }].map((item) => (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm" key={item.label}>
              <p className="text-3xl font-black text-emerald-600"><StatValue value={item.value} /></p>
              <p className="mt-2 text-sm font-semibold text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
