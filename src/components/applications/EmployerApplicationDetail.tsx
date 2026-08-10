import { useState } from 'react'
import { APPLICATION_STATUS_META } from '../../constants/applicationStatus'
import type { Application, ApplicationNotification, ApplicationStatus } from '../../types/application'
import type { Job } from '../../types/job'
import type { User } from '../../types/user'
import { formatDate } from '../../utils/formatDate'

interface EmployerApplicationDetailProps {
  application: Application
  candidate: User
  job: Job
  updating: boolean
  sending: boolean
  onClose: () => void
  onStatusChange: (status: ApplicationStatus, note: string) => Promise<boolean>
  onSendNotification: (channel: ApplicationNotification['channel'], message: string) => Promise<boolean>
}

export function EmployerApplicationDetail({ application, candidate, job, updating, sending, onClose, onStatusChange, onSendNotification }: EmployerApplicationDetailProps) {
  const profile = candidate.candidateProfile
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus>(application.status)
  const [statusNote, setStatusNote] = useState('')
  const [channel, setChannel] = useState<ApplicationNotification['channel']>('email')
  const [message, setMessage] = useState(
    `Xin chào ${candidate.fullName}, hồ sơ ứng tuyển vị trí ${job.title} của bạn hiện ở trạng thái “${APPLICATION_STATUS_META[application.status].label}”.`,
  )

  const updateStatus = async () => {
    if (selectedStatus === application.status) return
    const note = statusNote.trim() || `Chuyển hồ sơ sang trạng thái ${APPLICATION_STATUS_META[selectedStatus].label}`
    const updated = await onStatusChange(selectedStatus, note)
    if (updated) {
      setStatusNote('')
      setMessage(`Xin chào ${candidate.fullName}, hồ sơ ứng tuyển vị trí ${job.title} của bạn hiện ở trạng thái “${APPLICATION_STATUS_META[selectedStatus].label}”.`)
    }
  }

  const sendNotification = async () => {
    if (!message.trim()) return
    await onSendNotification(channel, message.trim())
  }

  return (
    <div aria-labelledby="candidate-detail-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-slate-100 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
          <div><p className="text-sm font-bold text-emerald-600">CHI TIẾT ỨNG VIÊN</p><h2 className="mt-1 text-2xl font-black text-slate-950" id="candidate-detail-title">{candidate.fullName}</h2><p className="mt-1 text-sm text-slate-500">Ứng tuyển {job.title} · {formatDate(application.appliedAt)}</p></div>
          <button aria-label="Đóng" className="rounded-lg p-2 text-2xl text-slate-400 hover:bg-slate-100" onClick={onClose} type="button">×</button>
        </header>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="section-title">Thông tin ứng viên</h3>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-400">Email</dt><dd className="mt-1 font-bold text-slate-700">{candidate.email}</dd></div><div><dt className="text-slate-400">Số điện thoại</dt><dd className="mt-1 font-bold text-slate-700">{candidate.phone || 'Chưa cập nhật'}</dd></div><div><dt className="text-slate-400">Vị trí mong muốn</dt><dd className="mt-1 font-bold text-slate-700">{profile?.headline || 'Chưa cập nhật'}</dd></div><div><dt className="text-slate-400">Kinh nghiệm</dt><dd className="mt-1 font-bold text-slate-700">{profile?.yearsOfExperience ?? 0} năm</dd></div><div className="sm:col-span-2"><dt className="text-slate-400">Địa chỉ</dt><dd className="mt-1 font-bold text-slate-700">{profile?.address || 'Chưa cập nhật'}</dd></div></dl>
              {profile?.bio && <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">{profile.bio}</p>}
              <div className="mt-5 flex flex-wrap gap-2">{profile?.skills.length ? profile.skills.map((skill) => <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700" key={skill}>{skill}</span>) : <span className="text-sm text-slate-400">Chưa cập nhật kỹ năng</span>}</div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="section-title">CV và thư giới thiệu</h3>
              <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">CV đã nộp</p><p className="mt-2 break-all font-bold text-emerald-700">{application.cvUrl.split('/').pop()}</p><p className="mt-1 text-xs text-slate-400">File CV được mô phỏng bằng metadata trong dự án frontend.</p></div>
              <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Thư giới thiệu</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{application.coverLetter || 'Ứng viên không gửi thư giới thiệu.'}</p></div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="section-title">Kinh nghiệm làm việc</h3>
              {profile?.experiences.length ? <div className="mt-5 space-y-4">{profile.experiences.map((experience) => <div className="border-l-2 border-emerald-200 pl-4" key={experience.id}><p className="font-black text-slate-800">{experience.position}</p><p className="mt-1 text-sm font-semibold text-slate-500">{experience.companyName} · {formatDate(experience.startDate)} – {experience.endDate ? formatDate(experience.endDate) : 'Hiện tại'}</p>{experience.description && <p className="mt-2 text-sm leading-6 text-slate-600">{experience.description}</p>}</div>)}</div> : <p className="mt-4 text-sm text-slate-400">Ứng viên chưa cập nhật kinh nghiệm.</p>}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="section-title">Học vấn</h3>
              {profile?.educations.length ? <div className="mt-5 space-y-4">{profile.educations.map((education) => <div className="border-l-2 border-blue-200 pl-4" key={education.id}><p className="font-black text-slate-800">{education.schoolName}</p><p className="mt-1 text-sm text-slate-500">{education.major} · {education.startYear} – {education.endYear ?? 'Hiện tại'}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-400">Ứng viên chưa cập nhật học vấn.</p>}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-900">Cập nhật trạng thái</h3>
              <span className={`mt-3 inline-block rounded-full px-3 py-1.5 text-sm font-bold ${APPLICATION_STATUS_META[application.status].className}`}>Hiện tại: {APPLICATION_STATUS_META[application.status].label}</span>
              <select className="field mt-4" onChange={(event) => setSelectedStatus(event.target.value as ApplicationStatus)} value={selectedStatus}><option value="pending">Đã nộp</option><option value="reviewing">Đang xem xét</option><option value="interviewed">Phỏng vấn</option><option value="accepted">Đã nhận</option><option value="rejected">Từ chối</option></select>
              <textarea className="field mt-3 min-h-24 resize-y" onChange={(event) => setStatusNote(event.target.value)} placeholder="Ghi chú thay đổi (không bắt buộc)" value={statusNote} />
              <button className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={updating || selectedStatus === application.status} onClick={() => void updateStatus()} type="button">{updating ? 'Đang cập nhật...' : 'Cập nhật trạng thái'}</button>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-900">Gửi thông báo mô phỏng</h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">Không gửi email thật. Nội dung sẽ được lưu vào đơn ứng tuyển để Candidate xem.</p>
              <select className="field mt-4" onChange={(event) => setChannel(event.target.value as ApplicationNotification['channel'])} value={channel}><option value="email">Email mô phỏng</option><option value="in-app">Thông báo trong ứng dụng</option></select>
              <textarea className="field mt-3 min-h-36 resize-y" maxLength={2000} onChange={(event) => setMessage(event.target.value)} value={message} />
              <button className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50" disabled={sending || !message.trim()} onClick={() => void sendNotification()} type="button">{sending ? 'Đang lưu...' : 'Gửi thông báo'}</button>
              {application.lastNotification && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800"><p className="font-bold">Lần gửi gần nhất · {formatDate(application.lastNotification.sentAt)}</p><p className="mt-1">{application.lastNotification.message}</p></div>}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-900">Lịch sử trạng thái</h3>
              <ol className="mt-4 space-y-4">{application.statusHistory.slice().reverse().map((history) => <li className="border-l-2 border-emerald-200 pl-3 text-sm" key={`${history.status}-${history.changedAt}`}><p className="font-bold text-slate-700">{APPLICATION_STATUS_META[history.status].label}</p><p className="mt-1 leading-5 text-slate-500">{history.note}</p><p className="mt-1 text-xs text-slate-400">{formatDate(history.changedAt)}</p></li>)}</ol>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
