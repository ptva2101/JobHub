import { Link, NavLink, Outlet } from 'react-router-dom'
import { NotificationBell } from '../components/notifications/NotificationBell'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

function dashboardPath(role: 'admin' | 'employer' | 'candidate') {
  return role === 'admin' ? '/admin' : role === 'employer' ? '/employer' : '/candidate'
}

export function ClientLayout() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()

  const handleLogout = () => {
    logout()
    showToast('Bạn đã đăng xuất.', 'info')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-950" to="/">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-sm text-white">JH</span>
            Job<span className="-ml-2 text-emerald-600">Hub</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold md:flex" aria-label="Điều hướng chính">
            <NavLink className={({ isActive }) => (isActive ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-700')} to="/" end>
              Trang chủ
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-700')} to="/jobs">
              Việc làm
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-700')} to="/companies">
              Công ty
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell />
                <Link className="hidden text-sm font-semibold text-slate-700 sm:block" to={dashboardPath(user.role)}>
                  {user.fullName}
                </Link>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-slate-300 hover:bg-slate-50" onClick={handleLogout} type="button">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" to="/login">Đăng nhập</Link>
                <Link className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700" to="/register">Đăng ký</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main><Outlet /></main>

      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© 2026 JobHub. Kết nối cơ hội, kiến tạo tương lai.</p>
          <p>Frontend demo sử dụng json-server.</p>
        </div>
      </footer>
    </div>
  )
}
