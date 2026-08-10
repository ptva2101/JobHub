import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return <div className="grid min-h-[70vh] place-items-center px-4 text-center"><div><p className="text-7xl font-black text-emerald-600">403</p><h1 className="mt-3 text-2xl font-black">Bạn không có quyền truy cập</h1><Link className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-bold text-white" to="/">Về trang chủ</Link></div></div>
}
