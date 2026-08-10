import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import type { Education, Experience } from '../../types/user'
import { generateId } from '../../utils/generateId'

const emptyProfile = {
  headline: '',
  address: '',
  bio: '',
  yearsOfExperience: 0,
  skills: [] as string[],
  experiences: [] as Experience[],
  educations: [] as Education[],
  cvUrl: null as string | null,
}

export function CandidateProfilePage() {
  const { user, updateCurrentUser } = useAuth()
  const { showToast } = useToast()
  const profile = user?.candidateProfile ?? emptyProfile
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    phone: user?.phone ?? '',
    headline: profile.headline,
    address: profile.address,
    bio: profile.bio,
    yearsOfExperience: String(profile.yearsOfExperience),
    skills: profile.skills.join(', '),
    cvUrl: profile.cvUrl,
  })
  const [experiences, setExperiences] = useState<Experience[]>(profile.experiences)
  const [educations, setEducations] = useState<Education[]>(profile.educations)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateForm = (key: keyof typeof form, value: string | null) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateExperience = (index: number, key: keyof Experience, value: string | null) => {
    setExperiences((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    )
  }

  const updateEducation = (index: number, key: keyof Education, value: string) => {
    setEducations((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: key === 'startYear' || key === 'endYear' ? Number(value) || null : value,
            }
          : item,
      ),
    )
  }

  const handleCvChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('CV phải là file PDF.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('CV không được vượt quá 5 MB.')
      event.target.value = ''
      return
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    updateForm('cvUrl', `/cvs/${safeFileName}`)
    setError('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return

    setSubmitting(true)
    setError('')
    try {
      await updateCurrentUser({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        candidateProfile: {
          headline: form.headline.trim(),
          address: form.address.trim(),
          bio: form.bio.trim(),
          yearsOfExperience: Math.max(0, Number(form.yearsOfExperience) || 0),
          skills: form.skills
            .split(',')
            .map((skill) => skill.trim())
            .filter(Boolean),
          experiences,
          educations,
          cvUrl: form.cvUrl,
        },
      })
      showToast('Đã lưu hồ sơ ứng viên thành công.', 'success')
    } catch {
      showToast('Không thể lưu hồ sơ. Hãy kiểm tra mock API và thử lại.', 'error', 3000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">HỒ SƠ ỨNG VIÊN</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Thông tin nghề nghiệp</h1>
      <p className="mt-2 text-slate-500">Cập nhật thông tin để dùng khi ứng tuyển việc làm.</p>

      <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="section-title">Thông tin cơ bản</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block"><span className="label">Họ và tên</span><input className="field mt-2" onChange={(event) => updateForm('fullName', event.target.value)} required value={form.fullName} /></label>
            <label className="block"><span className="label">Số điện thoại</span><input className="field mt-2" onChange={(event) => updateForm('phone', event.target.value)} required value={form.phone} /></label>
            <label className="block"><span className="label">Vị trí mong muốn</span><input className="field mt-2" onChange={(event) => updateForm('headline', event.target.value)} placeholder="Ví dụ: Frontend Developer" required value={form.headline} /></label>
            <label className="block"><span className="label">Địa chỉ</span><input className="field mt-2" onChange={(event) => updateForm('address', event.target.value)} required value={form.address} /></label>
            <label className="block"><span className="label">Số năm kinh nghiệm</span><input className="field mt-2" min="0" onChange={(event) => updateForm('yearsOfExperience', event.target.value)} type="number" value={form.yearsOfExperience} /></label>
            <label className="block"><span className="label">Kỹ năng (cách nhau bằng dấu phẩy)</span><input className="field mt-2" onChange={(event) => updateForm('skills', event.target.value)} placeholder="ReactJS, TypeScript, Git" value={form.skills} /></label>
            <label className="block sm:col-span-2"><span className="label">Giới thiệu bản thân</span><textarea className="field mt-2 min-h-28 resize-y" onChange={(event) => updateForm('bio', event.target.value)} required value={form.bio} /></label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4"><h2 className="section-title">Kinh nghiệm làm việc</h2><button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => setExperiences((current) => [...current, { id: generateId('experience'), companyName: '', position: '', startDate: '', endDate: null, description: '' }])} type="button">+ Thêm kinh nghiệm</button></div>
          {experiences.length === 0 ? <p className="mt-5 text-sm text-slate-500">Chưa có kinh nghiệm làm việc.</p> : <div className="mt-5 space-y-5">{experiences.map((experience, index) => <div className="rounded-xl border border-slate-200 p-4" key={experience.id}><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Công ty</span><input className="field mt-2" onChange={(event) => updateExperience(index, 'companyName', event.target.value)} required value={experience.companyName} /></label><label><span className="label">Vị trí</span><input className="field mt-2" onChange={(event) => updateExperience(index, 'position', event.target.value)} required value={experience.position} /></label><label><span className="label">Ngày bắt đầu</span><input className="field mt-2" onChange={(event) => updateExperience(index, 'startDate', event.target.value)} required type="date" value={experience.startDate} /></label><label><span className="label">Ngày kết thúc (để trống nếu đang làm)</span><input className="field mt-2" onChange={(event) => updateExperience(index, 'endDate', event.target.value || null)} type="date" value={experience.endDate ?? ''} /></label><label className="sm:col-span-2"><span className="label">Mô tả</span><textarea className="field mt-2 min-h-20" onChange={(event) => updateExperience(index, 'description', event.target.value)} value={experience.description} /></label></div><button className="mt-3 text-sm font-bold text-red-600" onClick={() => setExperiences((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Xóa kinh nghiệm</button></div>)}</div>}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4"><h2 className="section-title">Học vấn</h2><button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => setEducations((current) => [...current, { id: generateId('education'), schoolName: '', major: '', startYear: new Date().getFullYear(), endYear: null }])} type="button">+ Thêm học vấn</button></div>
          {educations.length === 0 ? <p className="mt-5 text-sm text-slate-500">Chưa có thông tin học vấn.</p> : <div className="mt-5 space-y-5">{educations.map((education, index) => <div className="rounded-xl border border-slate-200 p-4" key={education.id}><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Trường</span><input className="field mt-2" onChange={(event) => updateEducation(index, 'schoolName', event.target.value)} required value={education.schoolName} /></label><label><span className="label">Chuyên ngành</span><input className="field mt-2" onChange={(event) => updateEducation(index, 'major', event.target.value)} required value={education.major} /></label><label><span className="label">Năm bắt đầu</span><input className="field mt-2" min="1950" onChange={(event) => updateEducation(index, 'startYear', event.target.value)} required type="number" value={education.startYear} /></label><label><span className="label">Năm kết thúc</span><input className="field mt-2" min="1950" onChange={(event) => updateEducation(index, 'endYear', event.target.value)} type="number" value={education.endYear ?? ''} /></label></div><button className="mt-3 text-sm font-bold text-red-600" onClick={() => setEducations((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Xóa học vấn</button></div>)}</div>}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="section-title">CV PDF</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Bản frontend chỉ lưu tên và đường dẫn mô phỏng của CV, không tải nội dung PDF thật lên máy chủ. Dung lượng tối đa 5 MB.</p>
          <input accept="application/pdf,.pdf" className="mt-4 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2.5 file:font-bold file:text-emerald-700" onChange={handleCvChange} type="file" />
          {form.cvUrl && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><div className="flex items-center justify-between gap-3"><span className="truncate font-semibold">CV đã chọn: {form.cvUrl.split('/').pop()}</span><button className="shrink-0 font-bold text-red-600" onClick={() => updateForm('cvUrl', null)} type="button">Gỡ CV</button></div><p className="mt-1 text-xs text-emerald-700">Ứng dụng đang lưu metadata của file để mô phỏng chức năng upload.</p></div>}
        </section>

        {error && <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
        <button className="min-w-36 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
      </form>
    </div>
  )
}
