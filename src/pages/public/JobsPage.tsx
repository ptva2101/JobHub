import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { Pagination } from '../../components/common/Pagination'
import { JobCard } from '../../components/jobs/JobCard'
import { useDebounce } from '../../hooks/useDebounce'
import { jobService } from '../../services/jobService'
import type { EmploymentType, Job, JobFilters, WorkplaceType } from '../../types/job'

const initialFilters: JobFilters = {
  keyword: '',
  category: '',
  location: '',
  employmentType: '',
  workplaceType: '',
  minimumSalary: null,
}

const PAGE_SIZE = 12

export function JobsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [locationOptions, setLocationOptions] = useState<string[]>([])
  const debouncedKeyword = useDebounce(filters.keyword)

  useEffect(() => {
    let active = true
    jobService.getAll().then((data) => {
      if (!active) return
      setCategoryOptions([...new Set(data.map((job) => job.category))].sort((a, b) => a.localeCompare(b, 'vi')))
      setLocationOptions([...new Set(data.map((job) => job.location))].sort((a, b) => a.localeCompare(b, 'vi')))
    }).catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    jobService
      .getAll({
        keyword: debouncedKeyword,
        category: filters.category,
        location: filters.location,
        employmentType: filters.employmentType,
        workplaceType: filters.workplaceType,
        minimumSalary: filters.minimumSalary,
      })
      .then((data) => {
        if (active) {
          setJobs(data)
          setError('')
          setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(data.length / PAGE_SIZE))))
        }
      })
      .catch(() => active && setError('Không thể tải danh sách việc làm. Hãy kiểm tra mock API.'))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [debouncedKeyword, filters.category, filters.employmentType, filters.location, filters.minimumSalary, filters.workplaceType])

  const updateFilter = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => {
    setCurrentPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE))
  const paginatedJobs = useMemo(
    () => jobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, jobs],
  )
  const firstResult = jobs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastResult = Math.min(currentPage * PAGE_SIZE, jobs.length)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">Cơ hội nghề nghiệp</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Tìm công việc phù hợp với bạn</h1>
        <p className="mt-3 text-slate-500">Khám phá các vị trí đang tuyển dụng từ những doanh nghiệp uy tín.</p>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
          <label className="lg:col-span-2">
            <span className="sr-only">Từ khóa</span>
            <input className="field" onChange={(event) => updateFilter('keyword', event.target.value)} placeholder="Vị trí hoặc công ty..." value={filters.keyword} />
          </label>
          <select aria-label="Ngành nghề" className="field" onChange={(event) => updateFilter('category', event.target.value)} value={filters.category}>
            <option value="">Mọi ngành nghề</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select aria-label="Địa điểm" className="field" onChange={(event) => updateFilter('location', event.target.value)} value={filters.location}>
            <option value="">Mọi địa điểm</option>
            {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
          <select aria-label="Loại công việc" className="field" onChange={(event) => updateFilter('employmentType', event.target.value as EmploymentType | '')} value={filters.employmentType}>
            <option value="">Mọi loại việc</option>
            <option value="full-time">Toàn thời gian</option>
            <option value="part-time">Bán thời gian</option>
            <option value="contract">Hợp đồng</option>
            <option value="internship">Thực tập</option>
          </select>
          <select aria-label="Hình thức làm việc" className="field" onChange={(event) => updateFilter('workplaceType', event.target.value as WorkplaceType | '')} value={filters.workplaceType}>
            <option value="">Mọi hình thức</option>
            <option value="on-site">Tại văn phòng</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </select>
          <select aria-label="Mức lương tối thiểu" className="field" onChange={(event) => updateFilter('minimumSalary', event.target.value ? Number(event.target.value) : null)} value={filters.minimumSalary ?? ''}>
            <option value="">Mọi mức lương</option>
            <option value="5000000">Từ 5 triệu</option>
            <option value="10000000">Từ 10 triệu</option>
            <option value="15000000">Từ 15 triệu</option>
            <option value="20000000">Từ 20 triệu</option>
          </select>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <p className="font-bold text-slate-900">{jobs.length} việc làm đang mở</p>
        <button className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => { setFilters(initialFilters); setCurrentPage(1) }} type="button">Xóa bộ lọc</button>
      </div>

      {loading ? <Loading /> : error ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      ) : jobs.length === 0 ? (
        <EmptyState title="Chưa tìm thấy công việc" description="Hãy thử thay đổi từ khóa hoặc bộ lọc của bạn." />
      ) : (
        <><p className="mb-4 text-sm text-slate-500">Đang hiển thị {firstResult}–{lastResult} trong {jobs.length} kết quả</p><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{paginatedJobs.map((job) => <JobCard job={job} key={job.id} />)}</div><Pagination currentPage={currentPage} onPageChange={setCurrentPage} totalPages={totalPages} /></>
      )}
    </div>
  )
}
