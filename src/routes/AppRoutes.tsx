import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { Loading } from '../components/common/Loading'
import { AdminLayout } from '../layouts/AdminLayout'
import { CandidateLayout } from '../layouts/CandidateLayout'
import { ClientLayout } from '../layouts/ClientLayout'
import { EmployerLayout } from '../layouts/EmployerLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { CandidateDashboardPage } from '../pages/candidate/CandidateDashboardPage'
import { CandidateApplicationsPage } from '../pages/candidate/CandidateApplicationsPage'
import { CandidateBookmarksPage } from '../pages/candidate/CandidateBookmarksPage'
import { CandidateNotificationsPage } from '../pages/candidate/CandidateNotificationsPage'
import { CandidateProfilePage } from '../pages/candidate/CandidateProfilePage'
import { AdminJobsPage } from '../pages/admin/AdminJobsPage'
import { AdminUsersPage } from '../pages/admin/AdminUsersPage'
import { EmployerApplicationsPage } from '../pages/employer/EmployerApplicationsPage'
import { EmployerCompanyProfilePage } from '../pages/employer/EmployerCompanyProfilePage'
import { EmployerJobFormPage } from '../pages/employer/EmployerJobFormPage'
import { EmployerJobsPage } from '../pages/employer/EmployerJobsPage'
import { ForbiddenPage } from '../pages/ForbiddenPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { HomePage } from '../pages/public/HomePage'
import { CompaniesPage } from '../pages/public/CompaniesPage'
import { CompanyDetailPage } from '../pages/public/CompanyDetailPage'
import { JobDetailPage } from '../pages/public/JobDetailPage'
import { JobsPage } from '../pages/public/JobsPage'

const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
)
const EmployerDashboardPage = lazy(() =>
  import('../pages/employer/EmployerDashboardPage').then((module) => ({
    default: module.EmployerDashboardPage,
  })),
)

const dashboardFallback = <Loading label="Đang tải Dashboard..." />

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ClientLayout />}>
        <Route element={<HomePage />} index />
        <Route element={<JobsPage />} path="jobs" />
        <Route element={<JobDetailPage />} path="jobs/:jobId" />
        <Route element={<CompaniesPage />} path="companies" />
        <Route element={<CompanyDetailPage />} path="companies/:employerId" />
        <Route element={<LoginPage />} path="login" />
        <Route element={<RegisterPage />} path="register" />
        <Route element={<ForbiddenPage />} path="forbidden" />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['candidate']} />}>
        <Route element={<CandidateLayout />}>
          <Route element={<CandidateDashboardPage />} path="candidate" />
          <Route element={<CandidateProfilePage />} path="candidate/profile" />
          <Route element={<CandidateApplicationsPage />} path="candidate/applications" />
          <Route element={<CandidateBookmarksPage />} path="candidate/bookmarks" />
          <Route element={<CandidateNotificationsPage />} path="candidate/notifications" />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['employer']} />}>
        <Route element={<EmployerLayout />}>
          <Route element={<Suspense fallback={dashboardFallback}><EmployerDashboardPage /></Suspense>} path="employer" />
          <Route element={<EmployerCompanyProfilePage />} path="employer/profile" />
          <Route element={<EmployerJobsPage />} path="employer/jobs" />
          <Route element={<EmployerJobFormPage />} path="employer/jobs/create" />
          <Route element={<EmployerJobFormPage />} path="employer/jobs/:jobId/edit" />
          <Route element={<EmployerApplicationsPage />} path="employer/applications" />
          <Route element={<EmployerApplicationsPage />} path="employer/jobs/:jobId/applications" />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route element={<Suspense fallback={dashboardFallback}><AdminDashboardPage /></Suspense>} path="admin" />
          <Route element={<AdminUsersPage />} path="admin/users" />
          <Route element={<AdminJobsPage />} path="admin/jobs" />
        </Route>
      </Route>

      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  )
}
