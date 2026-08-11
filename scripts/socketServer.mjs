import { Server } from 'socket.io'

const PORT = 3002

const io = new Server(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

console.log(`🚀 Socket.IO Realtime Server đang chạy tại http://localhost:${PORT}`)

io.on('connection', (socket) => {
  console.log(`⚡ Client kết nối Socket: ${socket.id}`)

  // Client tham gia phòng cá nhân (dựa trên userId)
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(userId)
      console.log(`👤 Socket ${socket.id} đã tham gia phòng cá nhân: ${userId}`)
    }
  })

  // Khi có thông báo mới hoặc thay đổi thông báo
  socket.on('notify_notifications_changed', (payload) => {
    console.log('📢 Phát tin nhắn thông báo thay đổi tới tất cả client')
    io.emit('notifications_changed', payload ?? {})
  })

  // Khi nhà tuyển dụng cập nhật trạng thái đơn ứng tuyển
  socket.on('notify_application_status_changed', (data) => {
    console.log(`🔔 Cập nhật đơn ứng tuyển cho recipient: ${data?.recipientId}`)
    if (data?.recipientId) {
      // Gửi trực tiếp tới phòng của ứng viên đó
      io.to(data.recipientId).emit('application_status_changed', data)
    }
    // Phát thông báo cho chuông
    io.emit('notifications_changed', data ?? {})
  })

  // Khi có tin tuyển dụng mới
  socket.on('notify_new_job_posted', (data) => {
    console.log(`💼 Có việc làm mới từ công ty ${data?.companyName}`)
    io.emit('new_job_posted', data ?? {})
    io.emit('notifications_changed', data ?? {})
  })

  socket.on('disconnect', () => {
    console.log(`🔌 Client ngắt kết nối Socket: ${socket.id}`)
  })
})
