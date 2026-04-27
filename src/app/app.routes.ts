import { provideRouter, Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { roleGuard } from './auth/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },

  {
    path: 'home',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },

  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    children: [
      // ── Student routes ────────────────────────────────────────────────
      {
        path: 'fees',
        loadComponent: () => import('./components/fees/fees.component').then(m => m.PaymentTrackerComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'ADMIN'] }
      },
      {
        path: 'fees/:studentId',
        loadComponent: () => import('./components/fees/fees.component').then(m => m.PaymentTrackerComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'payment-history',
        loadComponent: () => import('./components/payment-history/payment-history.component').then(m => m.PaymentHistoryComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'ADMIN'] }
      },
      {
        path: 'payment-history/:studentId',
        loadComponent: () => import('./components/payment-history/payment-history.component').then(m => m.PaymentHistoryComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'payment-history-details/:paymentId',
        loadComponent: () => import('./components/payment-details/payment-details.component').then(m => m.PaymentDetailsComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'ADMIN'] }
      },
      {
        path: 'apply-leave',
        loadComponent: () => import('./components/apply-leave/apply-leave.component').then(m => m.ApplyLeaveComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT'] }
      },
      {
        path: 'student-attendance',
        loadComponent: () => import('./components/student-attendance/student-attendance.component').then(m => m.StudentAttendanceComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'ADMIN'] }
      },
      {
        path: 'student-attendance/:studentId',
        loadComponent: () => import('./components/student-attendance/student-attendance.component').then(m => m.StudentAttendanceComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'attendance-summary',
        loadComponent: () => import('./components/attendance-summary/attendance-summary.component').then(m => m.AttendanceSummaryComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN', 'SUPER_ADMIN'] }
      },

      // ── Teacher routes ────────────────────────────────────────────────
      {
        path: 'teacher-attendance',
        loadComponent: () => import('./components/teacher-attendance/teacher-attendance.component').then(m => m.TeacherAttendanceComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },

      // ── Shared list / detail routes (Teacher + Admin) ─────────────────
      {
        path: 'student-list',
        loadComponent: () => import('./components/student-list/student-list.component').then(m => m.StudentListComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },
      {
        path: 'student-details/:studentId',
        loadComponent: () => import('./components/student-details/student-details.component').then(m => m.StudentDetailsComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN', 'STUDENT'] }
      },
      {
        path: 'view-leaves',
        loadComponent: () => import('./components/view-leaves/view-leaves.component').then(m => m.ViewLeavesComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },
      {
        path: 'view-leaves/:studentId',
        loadComponent: () => import('./components/view-leaves/view-leaves.component').then(m => m.ViewLeavesComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'event-new',
        loadComponent: () => import('./components/event-form/event-form.component').then(m => m.EventFormComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },
      {
        path: 'event-edit/:id',
        loadComponent: () => import('./components/event-form/event-form.component').then(m => m.EventFormComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },

      // ── Admin-only routes ─────────────────────────────────────────────
      {
        path: 'payment-history-admin',
        loadComponent: () => import('./components/payment-history-admin/payment-history-admin.component').then(m => m.PaymentHistoryAdminComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'fee-reminders',
        loadComponent: () => import('./components/fee-reminders/fee-reminders.component').then(m => m.FeeRemindersComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'teacher-list',
        loadComponent: () => import('./components/teacher-list/teacher-list.component').then(m => m.TeacherListComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'teacher-details/:teacherId',
        loadComponent: () => import('./components/teacher-details/teacher-details.component').then(m => m.TeacherDetailsComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'TEACHER'] }
      },
      {
        path: 'register',
        loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'student-bulk-import',
        loadComponent: () => import('./components/bulk-import/bulk-import.component').then(m => m.BulkImportComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'teacher-bulk-import',
        loadComponent: () => import('./components/teacher-bulk-import/teacher-bulk-import.component').then(m => m.TeacherBulkImportComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },

      // ── Admin + Super Admin routes ─────────────────────────────────────
      {
        path: 'admin-list',
        loadComponent: () => import('./components/admin-list/admin-list.component').then(m => m.AdminListComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
      },
      {
        path: 'admin-details/:adminId',
        loadComponent: () => import('./components/admin-details/admin-details.component').then(m => m.AdminDetailsComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
      },
      {
        path: 'register-admin',
        loadComponent: () => import('./components/register-admin/register-admin.component').then(m => m.RegisterAdminComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
      },
      {
        path: 'audit-logs',
        loadComponent: () => import('./components/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
      },
      {
        path: 'fee-structure',
        loadComponent: () => import('./components/fee-structure/fee-structure.component').then(m => m.FeeStructureComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'ADMIN', 'SUPER_ADMIN'] }
      },
      {
        path: 'bus-fees',
        loadComponent: () => import('./components/bus-fees/bus-fees.component').then(m => m.BusFeesComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
      },

      // ── Exam / Results ────────────────────────────────────────────────
      {
        path: 'subject-config',
        loadComponent: () => import('./components/subject-config/subject-config.component').then(m => m.SubjectConfigComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'exam-config',
        loadComponent: () => import('./components/exam-config/exam-config.component').then(m => m.ExamConfigComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'student-stream',
        loadComponent: () => import('./components/student-stream/student-stream.component').then(m => m.StudentStreamComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'mark-entry',
        loadComponent: () => import('./components/mark-entry/mark-entry.component').then(m => m.MarkEntryComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },
      {
        path: 'my-results',
        loadComponent: () => import('./components/student-results/student-results.component').then(m => m.StudentResultsComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT'] }
      },
      {
        path: 'class-results',
        loadComponent: () => import('./components/class-results/class-results.component').then(m => m.ClassResultsComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },
      {
        path: 'report-card',
        loadComponent: () => import('./components/report-card/report-card.component').then(m => m.ReportCardComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN'] }
      },

      // ── Teacher Dashboard ────────────────────────────────────────────
      {
        path: 'teacher-dashboard',
        loadComponent: () => import('./components/teacher-dashboard/teacher-dashboard.component').then(m => m.TeacherDashboardComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER'] }
      },

      // ── Analytics Dashboard ───────────────────────────────────────────
      {
        path: 'analytics',
        loadComponent: () => import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
      },

      // ── Timetable ─────────────────────────────────────────────────────
      {
        path: 'timetable',
        loadComponent: () => import('./components/timetable/timetable.component').then(m => m.TimetableComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN', 'SUPER_ADMIN'] }
      },

      // ── Open to all authenticated users ──────────────────────────────
      {
        path: 'notice',
        loadComponent: () => import('./components/notice/notice.component').then(m => m.NoticeComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'] }
      },
      {
        path: 'event-calendar',
        loadComponent: () => import('./components/event-calendar/event-calendar.component').then(m => m.EventCalendarComponent)
      },
      {
        path: 'payment',
        loadComponent: () => import('./components/payment/payment.component').then(m => m.PaymentComponent)
      },
    ],
  },

  { path: '**', redirectTo: '/home', pathMatch: 'full' },
];

export const AppRoutingModule = {
  provideRouter: () => provideRouter(routes),
};
