export type NotificationType = 'new_job' | 'application_status'

export interface Notification {
  id: string
  recipientId: string
  type: NotificationType
  employerId: string
  jobId: string
  title: string
  message: string
  readAt: string | null
  createdAt: string
}
