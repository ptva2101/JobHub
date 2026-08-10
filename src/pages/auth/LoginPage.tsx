import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import type { AuthUser } from '../../types/user'

function roleHome(user: AuthUser) {
  return user.role === 'admin' ? '/admin' : user.role === 'employer' ? '/employer' : '/candidate'
}

export function LoginPage() {
  const { user, login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('candidate@jobhub.vn')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate replace to={roleHome(user)} />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const authenticatedUser = await login({ email, password })
      showToast(`Đăng nhập thành công. Xin chào ${authenticatedUser.fullName}!`, 'success')
      const requestedPath = (location.state as { from?: string } | null)?.from
      navigate(requestedPath || roleHome(authenticatedUser), { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Đăng nhập thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl place-items-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <p className="text-sm font-bold text-emerald-600">CHÀO MỪNG TRỞ LẠI</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Đăng nhập JobHub</h1>
        <p className="mt-2 text-sm text-slate-500">Dùng tài khoản mẫu hoặc tài khoản bạn đã đăng ký.</p>
        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <label className="block"><span className="label">Email</span><input autoComplete="email" className="field mt-2" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          <label className="block"><span className="label">Mật khẩu</span><input autoComplete="current-password" className="field mt-2" minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Chưa có tài khoản? <Link className="font-bold text-emerald-700" to="/register">Đăng ký ngay</Link></p>
        <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><strong>Tài khoản mẫu:</strong><br />candidate@jobhub.vn / 123456<br />employer@jobhub.vn / 123456<br />admin@jobhub.vn / 123456</div>
      </div>
    </div>
  )
}
