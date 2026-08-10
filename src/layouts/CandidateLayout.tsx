import { DashboardLayout } from './DashboardLayout'

export function CandidateLayout() {
  return (
    <DashboardLayout
      title="Ứng viên"
      navigation={[
        { label: 'Tổng quan', to: '/candidate', end: true },
        { label: 'Hồ sơ của tôi', to: '/candidate/profile' },
        { label: 'Đơn ứng tuyển', to: '/candidate/applications' },
        { label: 'Việc làm đã lưu', to: '/candidate/bookmarks' },
        { label: 'Thông báo', to: '/candidate/notifications' },
        { label: 'Công ty & đánh giá', to: '/companies' },
      ]}
    />
  )
}
