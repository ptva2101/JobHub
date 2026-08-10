export type JobStatus = 'draft' | 'open' | 'closed'
export type ModerationStatus =
  | 'unsubmitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hidden'
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship'
export type WorkplaceType = 'on-site' | 'hybrid' | 'remote'

export interface Salary {
  min: number
  max: number
  currency: 'VND' | 'USD'
  negotiable: boolean
}

export interface Job {
  id: string
  employerId: string
  title: string
  companyName: string
  companyLogoUrl: string | null
  category: string
  location: string
  employmentType: EmploymentType
  workplaceType: WorkplaceType
  salary: Salary
  description: string
  requirements: string[]
  benefits: string[]
  skills: string[]
  deadline: string
  status: JobStatus
  moderationStatus: ModerationStatus
  moderationReason: string | null
  submittedAt: string | null
  moderatedAt: string | null
  moderatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface JobFilters {
  keyword: string
  category: string
  location: string
  employmentType: EmploymentType | ''
  workplaceType: WorkplaceType | ''
  minimumSalary: number | null
}

export type JobPayload = Omit<
  Job,
  | 'id'
  | 'moderationStatus'
  | 'moderationReason'
  | 'submittedAt'
  | 'moderatedAt'
  | 'moderatedBy'
  | 'createdAt'
  | 'updatedAt'
>
