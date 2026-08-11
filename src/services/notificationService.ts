import type { Job } from '../types/job'
import type { Notification } from '../types/notification'
import type { User } from '../types/user'
import { generateId } from '../utils/generateId'
import { isPublicJob } from '../utils/jobModeration'
import { apiClient } from './apiClient'
import { companyFollowService } from './companyFollowService'

import { socketService } from './socketService'

export const NOTIFICATIONS_CHANGED_EVENT = 'jobhub:notifications-changed'

function announceNotificationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
  }
  socketService.notifyNotificationsChanged()
}

function sortNewestFirst(notifications: Notification[]): Notification[] {
  return [...notifications].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  )
}

function ensureRecipient(notification: Notification, recipientId: string) {
  if (notification.recipientId !== recipientId) {
    throw new Error('Bạn không có quyền thao tác thông báo này.')
  }
}

async function getOwnedJob(jobId: string, employerId: string): Promise<Job> {
  const job = await apiClient.get<Job>(`/jobs/${encodeURIComponent(jobId)}`)
  if (job.employerId !== employerId) {
    throw new Error('Bạn không có quyền quản lý thông báo của tin tuyển dụng này.')
  }
  return job
}

async function getByRecipient(recipientId: string): Promise<Notification[]> {
  const notifications = await apiClient.get<Notification[]>(
    `/notifications?recipientId=${encodeURIComponent(recipientId)}`,
  )
  notifications.forEach((notification) => ensureRecipient(notification, recipientId))
  return sortNewestFirst(notifications)
}

export const notificationService = {
  getByRecipient,

  async getUnreadCount(recipientId: string): Promise<number> {
    const notifications = await getByRecipient(recipientId)
    return notifications.filter((notification) => notification.readAt === null).length
  },

  async markReadOwned(id: string, recipientId: string): Promise<Notification> {
    const notification = await apiClient.get<Notification>(
      `/notifications/${encodeURIComponent(id)}`,
    )
    ensureRecipient(notification, recipientId)
    if (notification.readAt !== null) return notification

    const updatedNotification = await apiClient.patch<Notification>(`/notifications/${encodeURIComponent(id)}`, {
      readAt: new Date().toISOString(),
    })
    announceNotificationsChanged()
    return updatedNotification
  },

  async markAllReadOwned(recipientId: string): Promise<Notification[]> {
    const notifications = await getByRecipient(recipientId)
    const unreadNotifications = notifications.filter(
      (notification) => notification.readAt === null,
    )
    if (unreadNotifications.length === 0) return notifications

    const readAt = new Date().toISOString()
    const updatedNotifications = await Promise.all(
      unreadNotifications.map((notification) =>
        apiClient.patch<Notification>(
          `/notifications/${encodeURIComponent(notification.id)}`,
          { readAt },
        ),
      ),
    )
    const updatedById = new Map(
      updatedNotifications.map((notification) => [notification.id, notification]),
    )
    announceNotificationsChanged()

    return notifications.map(
      (notification) => updatedById.get(notification.id) ?? notification,
    )
  },

  async removeByJob(jobId: string, employerId: string): Promise<number> {
    await getOwnedJob(jobId, employerId)
    const notifications = await apiClient.get<Notification[]>(
      `/notifications?jobId=${encodeURIComponent(jobId)}`,
    )

    if (notifications.some((notification) => notification.employerId !== employerId)) {
      throw new Error('Dữ liệu thông báo không thuộc nhà tuyển dụng hiện tại.')
    }

    await Promise.all(
      notifications.map((notification) =>
        apiClient.delete(`/notifications/${encodeURIComponent(notification.id)}`),
      ),
    )
    if (notifications.length > 0) announceNotificationsChanged()
    return notifications.length
  },

  async notifyFollowersForJob(job: Job): Promise<Notification[]> {
    const storedJob = await getOwnedJob(job.id, job.employerId)
    if (!isPublicJob(storedJob)) return []

    const [companyFollowers, candidates, existingNotifications] = await Promise.all([
      companyFollowService.getByEmployer(storedJob.employerId),
      apiClient.get<User[]>('/users?role=candidate'),
      apiClient.get<Notification[]>(
        `/notifications?jobId=${encodeURIComponent(storedJob.id)}&type=new_job`,
      ),
    ])

    const candidateIds = new Set(candidates.map((candidate) => candidate.id))
    const existingRecipientIds = new Set(
      existingNotifications
        .filter((notification) => notification.type === 'new_job')
        .map((notification) => notification.recipientId),
    )
    const followerIds = [
      ...new Set(
        companyFollowers
          .filter((follow) => candidateIds.has(follow.candidateId))
          .map((follow) => follow.candidateId),
      ),
    ].filter((candidateId) => !existingRecipientIds.has(candidateId))

    const createdAt = new Date().toISOString()
    const creationResults = await Promise.allSettled(
      followerIds.map((recipientId) =>
        apiClient.post<Notification>('/notifications', {
          id: generateId('notification'),
          recipientId,
          type: 'new_job',
          employerId: storedJob.employerId,
          jobId: storedJob.id,
          title: `Việc làm mới từ ${storedJob.companyName}`,
          message: `${storedJob.companyName} vừa đăng tuyển vị trí ${storedJob.title}.`,
          readAt: null,
          createdAt,
        }),
      ),
    )
    const createdNotifications = creationResults.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    )

    if (createdNotifications.length > 0) announceNotificationsChanged()
    const failedCount = creationResults.length - createdNotifications.length
    if (failedCount > 0) {
      throw new Error(
        `Đã tạo ${createdNotifications.length} thông báo nhưng có ${failedCount} thông báo chưa gửi được.`,
      )
    }
    return sortNewestFirst(createdNotifications)
  },
}
