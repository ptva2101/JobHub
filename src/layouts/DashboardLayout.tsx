import { Link, NavLink, Outlet } from 'react-router-dom'
import { NotificationBell } from '../components/notifications/NotificationBell'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

interface DashboardLayoutProps {
  title: string
  navigation: Array<{ label: string; to: string; end?: boolean }>
}

export function DashboardLayout({ title, navigation }: DashboardLayoutProps) {
  const { user, logout } = useAuth()
  const { showToast } = useToast()

  const handleLogout = () => {
    logout()
    showToast('Bạn đã đăng xuất.', 'info')
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="text-xl font-black text-slate-950" to="/">Job<span className="text-emerald-600">Hub</span></Link>
          <div className="flex items-center gap-3 text-sm">
            <NotificationBell />
            <span className="hidden text-slate-500 sm:block">{user?.fullName}</span>
            <button className="rounded-lg border border-slate-200 px-3 py-2 font-semibold" onClick={handleLogout} type="button">Đăng xuất</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr] sm:px-6 lg:px-8">
        <aside className="rounded-2xl bg-slate-900 p-4 text-white md:min-h-[calc(100vh-8rem)]">
          <p className="px-3 pb-4 text-xs font-bold uppercase tracking-widest text-emerald-400">{title}</p>
          <nav className="flex gap-2 overflow-auto md:flex-col">
            {navigation.map((item) => (
              <NavLink
                className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                key={item.to}
                to={item.to}
                end={item.end}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  )
}
