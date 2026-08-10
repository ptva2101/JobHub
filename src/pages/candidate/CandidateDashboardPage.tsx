import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { applicationService } from '../../services/applicationService'
import { bookmarkService } from '../../services/bookmarkService'
import { calculateProfileCompletion } from '../../utils/calculateProfileCompletion'

export function CandidateDashboardPage() {
  const { user } = useAuth()
  const [applicationCount, setApplicationCount] = useState(0)
  const [bookmarkCount, setBookmarkCount] = useState(0)

  useEffect(() => {
    let active = true
    if (!user) return

    Promise.all([
      applicationService.getByCandidate(user.id),
      bookmarkService.getByCandidate(user.id),
    ]).then(([applications, bookmarks]) => {
      if (!active) return
      setApplicationCount(applications.length)
      setBookmarkCount(bookmarks.length)
    }).catch(() => undefined)

    return () => {
      active = false
    }
  }, [user])

  const profileCompletion = calculateProfileCompletion(user)

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">ỨNG VIÊN</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Xin chào, {user?.fullName}</h1>
      <p className="mt-2 text-slate-500">Theo dõi hồ sơ và hành trình ứng tuyển của bạn.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <Link className="rounded-2xl bg-white p-6 shadow-sm hover:ring-2 hover:ring-emerald-200" to="/candidate/applications"><p className="text-3xl font-black text-emerald-600">{applicationCount}</p><p className="mt-2 text-sm font-semibold text-slate-500">Đơn đã nộp</p></Link>
        <Link className="rounded-2xl bg-white p-6 shadow-sm hover:ring-2 hover:ring-emerald-200" to="/candidate/bookmarks"><p className="text-3xl font-black text-emerald-600">{bookmarkCount}</p><p className="mt-2 text-sm font-semibold text-slate-500">Việc đã lưu</p></Link>
        <Link className="rounded-2xl bg-white p-6 shadow-sm hover:ring-2 hover:ring-emerald-200" to="/candidate/profile"><p className="text-3xl font-black text-emerald-600">{profileCompletion}%</p><p className="mt-2 text-sm font-semibold text-slate-500">Hồ sơ hoàn thiện</p></Link>
      </div>
      <div className="mt-6 rounded-2xl bg-slate-950 p-6 text-white"><h2 className="text-xl font-black">Sẵn sàng cho cơ hội tiếp theo?</h2><p className="mt-2 text-sm text-slate-300">Khám phá các tin tuyển dụng mới và ứng tuyển bằng hồ sơ JobHub của bạn.</p><Link className="mt-5 inline-block rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950" to="/jobs">Tìm việc ngay</Link></div>
    </div>
  )
}
