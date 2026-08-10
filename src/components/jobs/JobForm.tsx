import { useState, type FormEvent } from 'react'
import type { EmploymentType, Job, JobPayload, JobStatus, WorkplaceType } from '../../types/job'
import { isJobExpired } from '../../utils/isJobExpired'

interface JobFormProps {
  employerId: string
  companyName: string
  companyLogoUrl: string | null
  initialJob?: Job
  submitting: boolean
  onSubmit: (payload: JobPayload) => Promise<void>
}

function lines(value: string): string[] {
  return [...new Set(value.split('\n').map((item) => item.trim()).filter(Boolean))]
}

function commaSeparated(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
}

export function JobForm({ employerId, companyName, companyLogoUrl, initialJob, submitting, onSubmit }: JobFormProps) {
  const [form, setForm] = useState({
    title: initialJob?.title ?? '',
    category: initialJob?.category ?? '',
    location: initialJob?.location ?? '',
    employmentType: initialJob?.employmentType ?? 'full-time' as EmploymentType,
    workplaceType: initialJob?.workplaceType ?? 'on-site' as WorkplaceType,
    salaryMin: initialJob ? String(initialJob.salary.min) : '',
    salaryMax: initialJob ? String(initialJob.salary.max) : '',
    currency: initialJob?.salary.currency ?? 'VND' as 'VND' | 'USD',
    negotiable: initialJob?.salary.negotiable ?? false,
    description: initialJob?.description ?? '',
    requirements: initialJob?.requirements.join('\n') ?? '',
    benefits: initialJob?.benefits.join('\n') ?? '',
    skills: initialJob?.skills.join(', ') ?? '',
    deadline: initialJob?.deadline ?? '',
    status: initialJob?.status ?? 'open' as JobStatus,
  })
  const [error, setError] = useState('')

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const salaryMin = form.salaryMin.trim() === '' ? Number.NaN : Number(form.salaryMin)
    const salaryMax = form.salaryMax.trim() === '' ? Number.NaN : Number(form.salaryMax)
    const requirementItems = lines(form.requirements)
    const benefitItems = lines(form.benefits)
    const skillItems = commaSeparated(form.skills)

    if (!form.title.trim() || !form.category.trim() || !form.location.trim() || !form.description.trim()) {
      setError('Vui lòng nhập đầy đủ các trường bắt buộc.')
      return
    }
    if (!form.negotiable && (!Number.isFinite(salaryMin) || !Number.isFinite(salaryMax) || salaryMin < 0 || salaryMax < salaryMin)) {
      setError('Mức lương phải hợp lệ và lương tối đa không được nhỏ hơn lương tối thiểu.')
      return
    }
    if (requirementItems.length === 0 || benefitItems.length === 0 || skillItems.length === 0) {
      setError('Vui lòng nhập ít nhất một yêu cầu, quyền lợi và kỹ năng.')
      return
    }
    if (!form.deadline) {
      setError('Vui lòng chọn hạn nộp hồ sơ.')
      return
    }
    if (form.status === 'open' && isJobExpired(form.deadline)) {
      setError('Tin đang tuyển phải có hạn nộp từ hôm nay trở đi.')
      return
    }

    await onSubmit({
      employerId,
      companyName,
      companyLogoUrl,
      title: form.title.trim(),
      category: form.category.trim(),
      location: form.location.trim(),
      employmentType: form.employmentType,
      workplaceType: form.workplaceType,
      salary: {
        min: form.negotiable ? 0 : salaryMin,
        max: form.negotiable ? 0 : salaryMax,
        currency: form.currency,
        negotiable: form.negotiable,
      },
      description: form.description.trim(),
      requirements: requirementItems,
      benefits: benefitItems,
      skills: skillItems,
      deadline: form.deadline,
      status: form.status,
    })
  }

  return (
    <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="section-title">Thông tin chung</h2>
        <p className="mt-2 text-sm text-slate-500">Tin tuyển dụng được đăng dưới tên <strong>{companyName}</strong>. Tin ở trạng thái “Đang tuyển” sẽ được gửi Admin kiểm duyệt trước khi hiển thị công khai.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="label">Tên vị trí *</span><input className="field mt-2" onChange={(event) => update('title', event.target.value)} placeholder="Ví dụ: Frontend Developer" required value={form.title} /></label>
          <label><span className="label">Ngành nghề *</span><input className="field mt-2" list="job-categories" onChange={(event) => update('category', event.target.value)} placeholder="Công nghệ thông tin" required value={form.category} /><datalist id="job-categories"><option value="Công nghệ thông tin" /><option value="Marketing" /><option value="Thiết kế" /><option value="Kinh doanh" /><option value="Nhân sự" /></datalist></label>
          <label><span className="label">Địa điểm *</span><input className="field mt-2" list="job-locations" onChange={(event) => update('location', event.target.value)} placeholder="TP. Hồ Chí Minh" required value={form.location} /><datalist id="job-locations"><option value="Hà Nội" /><option value="TP. Hồ Chí Minh" /><option value="Đà Nẵng" /><option value="Toàn quốc" /></datalist></label>
          <label><span className="label">Loại công việc</span><select className="field mt-2" onChange={(event) => update('employmentType', event.target.value as EmploymentType)} value={form.employmentType}><option value="full-time">Toàn thời gian</option><option value="part-time">Bán thời gian</option><option value="contract">Hợp đồng</option><option value="internship">Thực tập</option></select></label>
          <label><span className="label">Hình thức làm việc</span><select className="field mt-2" onChange={(event) => update('workplaceType', event.target.value as WorkplaceType)} value={form.workplaceType}><option value="on-site">Tại văn phòng</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
          <label><span className="label">Hạn nộp *</span><input className="field mt-2" onChange={(event) => update('deadline', event.target.value)} required type="date" value={form.deadline} /></label>
          <label><span className="label">Trạng thái</span><select className="field mt-2" onChange={(event) => update('status', event.target.value as JobStatus)} value={form.status}><option value="open">Đang tuyển</option><option value="draft">Bản nháp</option><option value="closed">Đã đóng</option></select></label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="section-title">Mức lương</h2>
        <label className="mt-5 flex w-fit items-center gap-3 text-sm font-bold text-slate-700"><input checked={form.negotiable} className="size-4 accent-emerald-600" onChange={(event) => update('negotiable', event.target.checked)} type="checkbox" />Lương thỏa thuận</label>
        <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_1fr_150px]">
          <label><span className="label">Lương tối thiểu</span><input className="field mt-2 disabled:bg-slate-100" disabled={form.negotiable} min="0" onChange={(event) => update('salaryMin', event.target.value)} required={!form.negotiable} step="100000" type="number" value={form.salaryMin} /></label>
          <label><span className="label">Lương tối đa</span><input className="field mt-2 disabled:bg-slate-100" disabled={form.negotiable} min="0" onChange={(event) => update('salaryMax', event.target.value)} required={!form.negotiable} step="100000" type="number" value={form.salaryMax} /></label>
          <label><span className="label">Đơn vị</span><select className="field mt-2" onChange={(event) => update('currency', event.target.value as 'VND' | 'USD')} value={form.currency}><option value="VND">VND</option><option value="USD">USD</option></select></label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="section-title">Nội dung tuyển dụng</h2>
        <div className="mt-5 space-y-5">
          <label className="block"><span className="label">Mô tả công việc *</span><textarea className="field mt-2 min-h-36 resize-y" onChange={(event) => update('description', event.target.value)} required value={form.description} /></label>
          <label className="block"><span className="label">Yêu cầu * <span className="font-normal text-slate-400">(mỗi dòng một nội dung)</span></span><textarea className="field mt-2 min-h-32 resize-y" onChange={(event) => update('requirements', event.target.value)} placeholder={'Có kinh nghiệm ReactJS\nBiết sử dụng Git'} required value={form.requirements} /></label>
          <label className="block"><span className="label">Quyền lợi * <span className="font-normal text-slate-400">(mỗi dòng một nội dung)</span></span><textarea className="field mt-2 min-h-32 resize-y" onChange={(event) => update('benefits', event.target.value)} placeholder={'Lương tháng 13\nBảo hiểm đầy đủ'} required value={form.benefits} /></label>
          <label className="block"><span className="label">Kỹ năng * <span className="font-normal text-slate-400">(cách nhau bằng dấu phẩy)</span></span><input className="field mt-2" onChange={(event) => update('skills', event.target.value)} placeholder="ReactJS, TypeScript, Git" required value={form.skills} /></label>
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button className="min-w-36 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Đang lưu...' : form.status === 'open' ? initialJob ? 'Lưu và gửi duyệt' : 'Tạo và gửi duyệt' : initialJob ? 'Lưu thay đổi' : 'Lưu tin'}</button></div>
    </form>
  )
}
