import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { jobService } from '../../services/jobService'
import type { CompanyProfile } from '../../types/user'

const companySizeOptions = [
  '1-10 nhân viên',
  '11-50 nhân viên',
  '51-100 nhân viên',
  '101-500 nhân viên',
  '501-1000 nhân viên',
  'Trên 1000 nhân viên',
]

interface CompanyProfileForm {
  representativeName: string
  phone: string
  name: string
  industry: string
  companySize: string
  address: string
  website: string
  description: string
  logoUrl: string
}

function initialForm(
  fullName: string,
  phone: string,
  profile: CompanyProfile | null,
): CompanyProfileForm {
  return {
    representativeName: fullName,
    phone,
    name: profile?.name ?? '',
    industry: profile?.industry ?? '',
    companySize: profile?.companySize ?? '',
    address: profile?.address ?? '',
    website: profile?.website ?? '',
    description: profile?.description ?? '',
    logoUrl: profile?.logoUrl ?? '',
  }
}

function validateForm(form: CompanyProfileForm): string {
  const requiredFields = [
    [form.representativeName, 'Tên người đại diện'],
    [form.phone, 'Số điện thoại'],
    [form.name, 'Tên công ty'],
    [form.industry, 'Ngành nghề'],
    [form.companySize, 'Quy mô công ty'],
    [form.address, 'Địa chỉ'],
    [form.description, 'Giới thiệu công ty'],
  ]
  const missingField = requiredFields.find(([value]) => !value.trim())
  if (missingField) return `${missingField[1]} không được để trống.`

  if (form.representativeName.trim().length < 2) return 'Tên người đại diện phải có ít nhất 2 ký tự.'
  if (form.name.trim().length < 2) return 'Tên công ty phải có ít nhất 2 ký tự.'
  if (form.industry.trim().length < 2) return 'Ngành nghề phải có ít nhất 2 ký tự.'
  if (form.address.trim().length < 3) return 'Địa chỉ phải có ít nhất 3 ký tự.'
  if (form.description.trim().length < 20) return 'Giới thiệu công ty phải có ít nhất 20 ký tự.'

  const normalizedPhone = form.phone.trim().replace(/[().\s-]/g, '')
  if (!/^\+?[0-9]{9,12}$/.test(normalizedPhone)) {
    return 'Số điện thoại phải có từ 9 đến 12 chữ số hợp lệ.'
  }

  if (form.website.trim()) {
    try {
      const website = new URL(form.website.trim())
      if (!['http:', 'https:'].includes(website.protocol)) throw new Error('invalid-protocol')
    } catch {
      return 'Website phải là URL hợp lệ bắt đầu bằng http:// hoặc https://.'
    }
  }

  const logoUrl = form.logoUrl.trim()
  if (logoUrl && !logoUrl.startsWith('/') && !/^https?:\/\//i.test(logoUrl)) {
    return 'Đường dẫn logo phải bắt đầu bằng /, http:// hoặc https://.'
  }

  return ''
}

export function EmployerCompanyProfilePage() {
  const { user, updateCurrentUser } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState(() => initialForm(
    user?.fullName ?? '',
    user?.phone ?? '',
    user?.companyProfile ?? null,
  ))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (key: keyof CompanyProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || user.role !== 'employer') return

    const validationError = validateForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    const companyProfile: CompanyProfile = {
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim() || null,
      industry: form.industry.trim(),
      companySize: form.companySize.trim(),
      address: form.address.trim(),
      website: form.website.trim(),
      description: form.description.trim(),
    }

    setSubmitting(true)
    setError('')
    let profileSaved = false
    try {
      await updateCurrentUser({
        fullName: form.representativeName.trim(),
        phone: form.phone.trim(),
        companyProfile,
      })
      profileSaved = true
      const syncResult = await jobService.syncCompanyIdentity(
        user.id,
        companyProfile.name,
        companyProfile.logoUrl,
      )
      if (syncResult.failed > 0) {
        const message = `Hồ sơ đã lưu nhưng còn ${syncResult.failed}/${syncResult.total} tin chưa đồng bộ. Hãy nhấn Lưu lại để thử tiếp.`
        setError(message)
        showToast(message, 'error')
        return
      }
      showToast('Đã cập nhật hồ sơ doanh nghiệp.', 'success')
    } catch {
      const message = profileSaved
        ? 'Hồ sơ đã được lưu nhưng chưa đồng bộ được tên hoặc logo trên các tin tuyển dụng. Hãy nhấn Lưu lại để thử đồng bộ.'
        : 'Không thể cập nhật hồ sơ doanh nghiệp. Hãy kiểm tra mock API và thử lại.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <p className="text-sm font-bold text-emerald-600">HỒ SƠ DOANH NGHIỆP</p>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="mt-1 text-3xl font-black text-slate-950">Thông tin công ty</h1><p className="mt-2 text-slate-500">Thông tin này được hiển thị trên trang công ty và các tin tuyển dụng của bạn.</p></div>{user && <Link className="text-sm font-bold text-emerald-700" to={`/companies/${user.id}`}>Xem trang công ty công khai →</Link>}</div>

      <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-black text-slate-950">Thông tin liên hệ</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block"><span className="label">Người đại diện</span><input autoComplete="name" className="field mt-2" maxLength={100} onChange={(event) => updateField('representativeName', event.target.value)} required value={form.representativeName} /></label>
            <label className="block"><span className="label">Số điện thoại</span><input autoComplete="tel" className="field mt-2" maxLength={20} onChange={(event) => updateField('phone', event.target.value)} required type="tel" value={form.phone} /></label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-black text-slate-950">Thông tin doanh nghiệp</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="label">Tên công ty</span><input className="field mt-2" maxLength={120} onChange={(event) => updateField('name', event.target.value)} required value={form.name} /></label>
            <label className="block"><span className="label">Ngành nghề</span><input className="field mt-2" maxLength={100} onChange={(event) => updateField('industry', event.target.value)} placeholder="Ví dụ: Công nghệ thông tin" required value={form.industry} /></label>
            <label className="block"><span className="label">Quy mô công ty</span><select className="field mt-2" onChange={(event) => updateField('companySize', event.target.value)} required value={form.companySize}><option value="">Chọn quy mô</option>{companySizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="block sm:col-span-2"><span className="label">Địa chỉ</span><input className="field mt-2" maxLength={200} onChange={(event) => updateField('address', event.target.value)} required value={form.address} /></label>
            <label className="block"><span className="label">Website</span><input className="field mt-2" maxLength={250} onChange={(event) => updateField('website', event.target.value)} placeholder="https://congty.vn" type="url" value={form.website} /></label>
            <label className="block"><span className="label">Đường dẫn logo (mô phỏng)</span><input className="field mt-2" maxLength={500} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="/companies/logo.png hoặc https://..." value={form.logoUrl} /><span className="mt-2 block text-xs text-slate-400">Frontend chỉ lưu đường dẫn, không tải file ảnh thật lên máy chủ.</span></label>
            <label className="block sm:col-span-2"><span className="label">Giới thiệu công ty</span><textarea className="field mt-2 min-h-40 resize-y" maxLength={2000} onChange={(event) => updateField('description', event.target.value)} required value={form.description} /></label>
          </div>
        </section>

        {error && <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end"><button className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Đang lưu và đồng bộ...' : 'Lưu hồ sơ doanh nghiệp'}</button></div>
      </form>
    </div>
  )
}
