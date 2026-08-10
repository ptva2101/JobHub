import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import type { UserRole } from '../../types/user'

export function RegisterPage() {
  const { user, register } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('candidate')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const dashboard = user.role === 'admin' ? '/admin' : user.role === 'candidate' ? '/candidate' : '/employer'
    return <Navigate replace to={dashboard} />
  }

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp. Vui lòng nhập lại.')
      return
    }

    const { confirmPassword, ...registerForm } = form
    void confirmPassword
    setSubmitting(true)
    try {
      await register({ ...registerForm, role })
      showToast('Tạo tài khoản thành công.', 'success')
      navigate(role === 'candidate' ? '/candidate' : '/employer', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Đăng ký thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl place-items-center px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <p className="text-sm font-bold text-emerald-600">BẮT ĐẦU VỚI JOBHUB</p><h1 className="mt-2 text-3xl font-black text-slate-950">Tạo tài khoản</h1>
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button className={`rounded-lg px-3 py-2.5 text-sm font-bold ${role === 'candidate' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setRole('candidate')} type="button">Ứng viên</button>
          <button className={`rounded-lg px-3 py-2.5 text-sm font-bold ${role === 'employer' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setRole('employer')} type="button">Nhà tuyển dụng</button>
        </div>
        <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block sm:col-span-2"><span className="label">Họ và tên</span><input className="field mt-2" onChange={(event) => update('fullName', event.target.value)} required value={form.fullName} /></label>
          <label className="block"><span className="label">Email</span><input className="field mt-2" onChange={(event) => update('email', event.target.value)} required type="email" value={form.email} /></label>
          <label className="block"><span className="label">Số điện thoại</span><input className="field mt-2" onChange={(event) => update('phone', event.target.value)} required value={form.phone} /></label>
          {role === 'employer' && <label className="block sm:col-span-2"><span className="label">Tên công ty</span><input className="field mt-2" onChange={(event) => update('companyName', event.target.value)} required value={form.companyName} /></label>}
          <label className="block sm:col-span-2"><span className="label">Mật khẩu</span><input autoComplete="new-password" className="field mt-2" minLength={6} onChange={(event) => update('password', event.target.value)} required type="password" value={form.password} /></label>
          <label className="block sm:col-span-2"><span className="label">Xác nhận mật khẩu</span><input autoComplete="new-password" className="field mt-2" minLength={6} onChange={(event) => update('confirmPassword', event.target.value)} required type="password" value={form.confirmPassword} /></label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 sm:col-span-2">{error}</p>}
          <button className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60 sm:col-span-2" disabled={submitting} type="submit">{submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Đã có tài khoản? <Link className="font-bold text-emerald-700" to="/login">Đăng nhập</Link></p>
      </div>
    </div>
  )
}
