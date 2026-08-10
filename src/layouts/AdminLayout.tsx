import { DashboardLayout } from './DashboardLayout'

export function AdminLayout() {
  return (
    <DashboardLayout
      title="Quản trị viên"
      navigation={[
        { label: 'Tổng quan', to: '/admin', end: true },
        { label: 'Quản lý tài khoản', to: '/admin/users' },
        { label: 'Kiểm duyệt tin', to: '/admin/jobs' },
      ]}
    />
  )
}
