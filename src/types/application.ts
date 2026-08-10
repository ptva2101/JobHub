export type ApplicationStatus =
  | 'pending'
  | 'reviewing'
  | 'interviewed'
  | 'accepted'
  | 'rejected'

export interface ApplicationStatusHistory {
  status: ApplicationStatus
  changedBy: string
  changedAt: string
  note: string
}

export interface ApplicationNotification {
  channel: 'email' | 'in-app'
  message: string
  sentAt: string
}

export interface Application {
  id: string
  jobId: string
  candidateId: string
  cvUrl: string
  coverLetter: string
  status: ApplicationStatus
  statusHistory: ApplicationStatusHistory[]
  lastNotification: ApplicationNotification | null
  appliedAt: string
  updatedAt: string
}
