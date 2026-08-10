interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function visiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  return Array.from({ length: 5 }, (_, index) => start + index)
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Phân trang" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} type="button">← Trước</button>
      {visiblePages(currentPage, totalPages).map((page) => <button aria-current={page === currentPage ? 'page' : undefined} aria-label={`Trang ${page}`} className={`size-10 rounded-lg text-sm font-bold ${page === currentPage ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`} key={page} onClick={() => onPageChange(page)} type="button">{page}</button>)}
      <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} type="button">Sau →</button>
    </nav>
  )
}
