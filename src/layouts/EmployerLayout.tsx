import { DashboardLayout } from './DashboardLayout'

export function EmployerLayout() {
  return (
    <DashboardLayout
      title="Nhà tuyển dụng"
      navigation={[
        { label: 'Tổng quan', to: '/employer', end: true },
        { label: 'Hồ sơ doanh nghiệp', to: '/employer/profile' },
        { label: 'Tin tuyển dụng', to: '/employer/jobs' },
        { label: 'Hồ sơ ứng tuyển', to: '/employer/applications' },
        { label: 'Trang chủ JobHub', to: '/', end: true },
        { label: 'Xem việc làm công khai', to: '/jobs' },
      ]}
    />
  )
}
