export type UserRole = 'admin' | 'employer' | 'candidate'
export type AccountStatus = 'active' | 'locked'

export interface Experience {
  id: string
  companyName: string
  position: string
  startDate: string
  endDate: string | null
  description: string
}

export interface Education {
  id: string
  schoolName: string
  major: string
  startYear: number
  endYear: number | null
}

export interface CandidateProfile {
  headline: string
  address: string
  bio: string
  yearsOfExperience: number
  skills: string[]
  experiences: Experience[]
  educations: Education[]
  cvUrl: string | null
}

export interface CompanyProfile {
  name: string
  logoUrl: string | null
  industry: string
  companySize: string
  address: string
  website: string
  description: string
}

export interface User {
  id: string
  email: string
  password: string
  role: UserRole
  fullName: string
  phone: string
  avatarUrl: string | null
  candidateProfile: CandidateProfile | null
  companyProfile: CompanyProfile | null
  /** Dữ liệu cũ không có trường này được coi là `active`. */
  accountStatus?: AccountStatus
  lockedAt?: string | null
  lockedBy?: string | null
  lockReason?: string | null
  createdAt: string
  updatedAt: string
}

export type AuthUser = Omit<User, 'password'>
