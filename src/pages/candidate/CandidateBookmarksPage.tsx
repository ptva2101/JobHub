import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { JobCard } from '../../components/jobs/JobCard'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { bookmarkService } from '../../services/bookmarkService'
import { jobService } from '../../services/jobService'
import type { Bookmark } from '../../types/bookmark'
import type { Job } from '../../types/job'

interface BookmarkItem {
  bookmark: Bookmark
  job: Job
}

export function CandidateBookmarksPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState<BookmarkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!user) return

    bookmarkService
      .getByCandidate(user.id)
      .then(async (bookmarks) =>
        Promise.all(
          bookmarks.map(async (bookmark) => ({
            bookmark,
            job: await jobService.getById(bookmark.jobId),
          })),
        ),
      )
      .then((data) => active && setItems(data))
      .catch(() => active && setError('Không thể tải danh sách việc làm đã lưu.'))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [user])

  const removeBookmark = async (bookmarkId: string) => {
    if (!window.confirm('Bạn muốn bỏ lưu công việc này?')) return
    try {
      await bookmarkService.remove(bookmarkId)
      setItems((current) => current.filter((item) => item.bookmark.id !== bookmarkId))
      showToast('Đã bỏ công việc khỏi danh sách đã lưu.', 'success')
    } catch {
      showToast('Không thể bỏ lưu công việc. Hãy thử lại.', 'error', 3000)
    }
  }

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">DANH SÁCH QUAN TÂM</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Việc làm đã lưu</h1>
      <p className="mt-2 text-slate-500">Xem lại những cơ hội bạn muốn ứng tuyển sau.</p>

      <div className="mt-7">
        {loading ? <Loading /> : error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : items.length === 0 ? <EmptyState title="Chưa có việc làm đã lưu" description="Mở một tin tuyển dụng và nhấn Lưu việc làm để thêm vào đây." /> : <div className="grid gap-5 xl:grid-cols-2">{items.map(({ bookmark, job }) => <JobCard action={<button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => void removeBookmark(bookmark.id)} type="button">Bỏ lưu</button>} job={job} key={bookmark.id} />)}</div>}
      </div>
    </div>
  )
}
