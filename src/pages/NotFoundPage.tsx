import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center text-white"><div><p className="text-8xl font-black text-emerald-400">404</p><h1 className="mt-3 text-2xl font-black">Trang không tồn tại</h1><Link className="mt-6 inline-block rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950" to="/">Về trang chủ</Link></div></div>
}
