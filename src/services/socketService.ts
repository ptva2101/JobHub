import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3002'

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
})

export const socketService = {
  joinUserRoom(userId: string) {
    if (userId) {
      socket.emit('join_user_room', userId)
    }
  },

  notifyNotificationsChanged(payload?: unknown) {
    socket.emit('notify_notifications_changed', payload)
  },

  notifyApplicationStatusChanged(payload: {
    recipientId: string
    applicationId: string
    status: string
    jobTitle?: string
    message?: string
  }) {
    socket.emit('notify_application_status_changed', payload)
  },

  notifyNewJobPosted(payload: {
    jobId: string
    employerId: string
    companyName: string
    title: string
  }) {
    socket.emit('notify_new_job_posted', payload)
  },
}
