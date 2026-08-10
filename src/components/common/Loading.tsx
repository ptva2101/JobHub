export function Loading({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-3 text-slate-500" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      <span>{label}</span>
    </div>
  )
}
