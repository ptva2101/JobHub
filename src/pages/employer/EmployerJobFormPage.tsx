import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loading } from '../../components/common/Loading'
import { JobForm } from '../../components/jobs/JobForm'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { jobService } from '../../services/jobService'
import { notificationService } from '../../services/notificationService'
import type { Job, JobPayload } from '../../types/job'
import { isPublicJob } from '../../utils/jobModeration'

export function EmployerJobFormPage() {
  const { jobId } = useParams()
  const editing = Boolean(jobId)
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(editing)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    if (!jobId || !user) return

    jobService
      .getById(jobId)
      .then((data) => {
        if (!active) return
        if (data.employerId !== user.id) {
          navigate('/forbidden', { replace: true })
          return
        }
        setJob(data)
      })
      .catch(() => active && setLoadError('Không tìm thấy tin tuyển dụng cần sửa.'))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [jobId, navigate, user])

  const submitJob = async (payload: JobPayload) => {
    if (!user) return
    setSubmitting(true)
    try {
      if (jobId) {
        const updatedJob = await jobService.updateOwned(jobId, user.id, payload)
        if (job && !isPublicJob(job) && isPublicJob(updatedJob)) {
          try {
            const createdNotifications = await notificationService.notifyFollowersForJob(updatedJob)
            showToast(
              createdNotifications.length > 0
                ? `Đã cập nhật tin và gửi ${createdNotifications.length} thông báo tới người theo dõi.`
                : 'Đã cập nhật tin tuyển dụng.',
              'success',
            )
          } catch {
            showToast(
              'Tin đã được cập nhật và mở thành công, nhưng chưa thể gửi đủ thông báo tới người theo dõi.',
              'info',
            )
          }
        } else {
          showToast(
            updatedJob.moderationStatus === 'pending'
              ? 'Đã cập nhật và gửi tin chờ Admin duyệt.'
              : updatedJob.moderationStatus === 'unsubmitted'
                ? 'Đã lưu bản nháp tuyển dụng.'
                : 'Đã cập nhật tin tuyển dụng.',
            'success',
          )
        }
      } else {
        const createdJob = await jobService.create(payload)
        showToast(
          createdJob.moderationStatus === 'pending'
            ? 'Đã tạo tin và gửi Admin chờ duyệt.'
            : 'Đã lưu tin tuyển dụng chưa gửi duyệt.',
          'success',
        )
      }
      navigate('/employer/jobs', { replace: true })
    } catch (submitError) {
      showToast(submitError instanceof Error ? submitError.message : 'Không thể lưu tin tuyển dụng.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading label="Đang tải tin tuyển dụng..." />
  if (loadError || (editing && !job)) return <div><p className="rounded-xl bg-red-50 p-4 font-semibold text-red-700">{loadError}</p><Link className="mt-4 inline-block font-bold text-emerald-700" to="/employer/jobs">← Quay lại danh sách</Link></div>
  if (!user) return null

  const companyName = user.companyProfile?.name || 'Công ty chưa cập nhật'

  return (
    <div>
      <Link className="text-sm font-bold text-emerald-700" to="/employer/jobs">← Quay lại danh sách</Link>
      <p className="mt-5 text-sm font-bold text-emerald-600">TIN TUYỂN DỤNG</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">{editing ? 'Chỉnh sửa tin tuyển dụng' : 'Đăng tin tuyển dụng mới'}</h1>
      <p className="mt-2 text-slate-500">Điền đầy đủ thông tin để ứng viên hiểu rõ cơ hội việc làm.</p>
      <JobForm companyLogoUrl={user.companyProfile?.logoUrl ?? null} companyName={companyName} employerId={user.id} initialJob={job ?? undefined} onSubmit={submitJob} submitting={submitting} />
    </div>
  )
}
