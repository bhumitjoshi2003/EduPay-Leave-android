import { provideRouter, Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { roleGuard } from './auth/role.guard';
import { featureGuard } from './auth/feature.guard';
import { passwordChangeGuard } from './auth/password-change.guard';

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
    path: 'change-initial-password',
    loadComponent: () => import('./components/change-initial-password/change-initial-password.component').then(m => m.ChangeInitialPasswordComponent),
    canActivate: [passwordChangeGuard]
  },
  {
    path: 'verify-rc',
    loadComponent: () => import('./components/verify-rc/verify-rc.component').then(m => m.VerifyRcComponent)
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
        canActivate: [roleGuard, featureGuard], data: { roles: ['STUDENT', 'ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'fees/:studentId',
        loadComponent: () => import('./components/fees/fees.component').then(m => m.PaymentTrackerComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'payment-history',
        loadComponent: () => import('./components/payment-history/payment-history.component').then(m => m.PaymentHistoryComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['STUDENT', 'ADMIN'], featureKey: 'PAYMENT_COLLECTION' }
      },
      {
        path: 'payment-history/:studentId',
        loadComponent: () => import('./components/payment-history/payment-history.component').then(m => m.PaymentHistoryComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'PAYMENT_COLLECTION' }
      },
      {
        path: 'payment-history-details/:paymentId',
        loadComponent: () => import('./components/payment-details/payment-details.component').then(m => m.PaymentDetailsComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['STUDENT', 'ADMIN'], featureKey: 'PAYMENT_COLLECTION' }
      },
      {
        path: 'apply-leave',
        loadComponent: () => import('./components/apply-leave/apply-leave.component').then(m => m.ApplyLeaveComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT'] }
      },
      {
        path: 'attendance-summary',
        loadComponent: () => import('./components/attendance-summary/attendance-summary.component').then(m => m.AttendanceSummaryComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN'] }
      },

      // ── Teacher routes ────────────────────────────────────────────────
      {
        path: 'teacher-attendance',
        loadComponent: () => import('./components/teacher-attendance/teacher-attendance.component').then(m => m.TeacherAttendanceComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },
      {
        path: 'apply-teacher-leave',
        loadComponent: () => import('./components/apply-teacher-leave/apply-teacher-leave.component').then(m => m.ApplyTeacherLeaveComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER'] }
      },
      {
        path: 'teacher-leave-requests',
        loadComponent: () => import('./components/teacher-leave-requests/teacher-leave-requests.component').then(m => m.TeacherLeaveRequestsComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },

      // ── Admin global search ───────────────────────────────────────────
      {
        path: 'student-search',
        loadComponent: () => import('./components/student-search/student-search.component').then(m => m.StudentSearchComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
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
        canActivate: [roleGuard], data: { roles: ['TEACHER', 'ADMIN'] }
      },
      {
        path: 'event-new',
        loadComponent: () => import('./components/event-form/event-form.component').then(m => m.EventFormComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'event-edit/:id',
        loadComponent: () => import('./components/event-form/event-form.component').then(m => m.EventFormComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },

      // ── Super Admin ───────────────────────────────────────────────────
      {
        path: 'super-admin-dashboard',
        loadComponent: () => import('./components/super-admin-dashboard/super-admin-dashboard.component').then(m => m.SuperAdminDashboardComponent),
        canActivate: [roleGuard], data: { roles: ['SUPER_ADMIN'] }
      },

      // ── School settings ───────────────────────────────────────────────
      {
        path: 'school-settings',
        loadComponent: () => import('./components/school-settings/school-settings.component').then(m => m.SchoolSettingsComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },
      {
        path: 'knowledge-base',
        loadComponent: () => import('./components/knowledge-base/knowledge-base.component').then(m => m.KnowledgeBaseComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'AI_COPILOT' }
      },
      {
        path: 'class-management',
        loadComponent: () => import('./components/class-management/class-management.component').then(m => m.ClassManagementComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUB_ADMIN'] }
      },
      {
        path: 'holiday-calendar',
        loadComponent: () => import('./components/holiday-calendar/holiday-calendar.component').then(m => m.HolidayCalendarComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'TEACHER', 'STUDENT'] }
      },
      {
        path: 'teacher-checkin',
        loadComponent: () => import('./components/teacher-checkin/teacher-checkin.component').then(m => m.TeacherCheckinComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER'] }
      },
      {
        path: 'staff-attendance',
        loadComponent: () => import('./components/staff-attendance/staff-attendance.component').then(m => m.StaffAttendanceComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN'] }
      },

      // ── Exams & Assessment ────────────────────────────────────────────
      {
        path: 'assessment-groups',
        loadComponent: () => import('./components/assessment-group-config/assessment-group-config.component').then(m => m.AssessmentGroupConfigComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'report-card-templates',
        loadComponent: () => import('./components/report-card-template-config/report-card-template-config.component').then(m => m.ReportCardTemplateConfigComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'REPORT_CARD' }
      },
      {
        path: 'report-card-remarks',
        loadComponent: () => import('./components/remarks-entry/remarks-entry.component').then(m => m.RemarksEntryComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN', 'TEACHER'], featureKey: 'REPORT_CARD' }
      },
      {
        path: 'bulk-report-cards',
        loadComponent: () => import('./components/bulk-report-card/bulk-report-card.component').then(m => m.BulkReportCardComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN', 'TEACHER'], featureKey: 'REPORT_CARD' }
      },
      {
        path: 'class-overview',
        loadComponent: () => import('./components/class-overview/class-overview.component').then(m => m.ClassOverviewComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN', 'TEACHER'], featureKey: 'REPORT_CARD' }
      },

      // ── Admin-only routes ─────────────────────────────────────────────
      {
        path: 'payment-history-admin',
        loadComponent: () => import('./components/payment-history-admin/payment-history-admin.component').then(m => m.PaymentHistoryAdminComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'PAYMENT_COLLECTION' }
      },
      {
        path: 'fee-reminders',
        loadComponent: () => import('./components/fee-reminders/fee-reminders.component').then(m => m.FeeRemindersComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_REMINDERS' }
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
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'BULK_IMPORT' }
      },
      {
        path: 'student-promotion',
        loadComponent: () => import('./components/student-promotion/student-promotion.component').then(m => m.StudentPromotionComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'STUDENT_PROMOTION' }
      },
      {
        path: 'teacher-bulk-import',
        loadComponent: () => import('./components/teacher-bulk-import/teacher-bulk-import.component').then(m => m.TeacherBulkImportComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'BULK_IMPORT' }
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
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'AUDIT_LOGS' }
      },
      {
        path: 'fee-structure',
        loadComponent: () => import('./components/fee-structure/fee-structure.component').then(m => m.FeeStructureComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['STUDENT', 'ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'bus-fees',
        loadComponent: () => import('./components/bus-fees/bus-fees.component').then(m => m.BusFeesComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'fee-assignment',
        loadComponent: () => import('./components/fee-assignment/fee-assignment.component').then(m => m.FeeAssignmentComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },

      // ── New Fee System (invoice-based) ────────────────────────────────
      {
        path: 'fee-head-management',
        loadComponent: () => import('./components/fee-head-management/fee-head-management.component').then(m => m.FeeHeadManagementComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'fee-rule-config',
        loadComponent: () => import('./components/fee-rule-config/fee-rule-config.component').then(m => m.FeeRuleConfigComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'invoice-management',
        loadComponent: () => import('./components/invoice-management/invoice-management.component').then(m => m.InvoiceManagementComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'invoice-detail/:invoiceId',
        loadComponent: () => import('./components/invoice-detail/invoice-detail.component').then(m => m.InvoiceDetailComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN', 'STUDENT'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'student-fees',
        loadComponent: () => import('./components/student-fee-overview/student-fee-overview.component').then(m => m.StudentFeeOverviewComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['STUDENT'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'student-fees/:studentId',
        loadComponent: () => import('./components/student-fee-overview/student-fee-overview.component').then(m => m.StudentFeeOverviewComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },
      {
        path: 'fee-recalculation',
        loadComponent: () => import('./components/fee-recalculation/fee-recalculation.component').then(m => m.FeeRecalculationComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'FEE_MANAGEMENT' }
      },

      // ── Exam / Results ────────────────────────────────────────────────
      {
        path: 'subject-config',
        loadComponent: () => import('./components/subject-config/subject-config.component').then(m => m.SubjectConfigComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'exam-config',
        loadComponent: () => import('./components/exam-config/exam-config.component').then(m => m.ExamConfigComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'student-stream',
        loadComponent: () => import('./components/student-stream/student-stream.component').then(m => m.StudentStreamComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'elective-assignment',
        loadComponent: () => import('./components/elective-assignment/elective-assignment.component').then(m => m.ElectiveAssignmentComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'mark-entry',
        loadComponent: () => import('./components/mark-entry/mark-entry.component').then(m => m.MarkEntryComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['TEACHER', 'ADMIN'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'my-results',
        loadComponent: () => import('./components/student-results/student-results.component').then(m => m.StudentResultsComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['STUDENT'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'class-results',
        loadComponent: () => import('./components/class-results/class-results.component').then(m => m.ClassResultsComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['TEACHER', 'ADMIN'], featureKey: 'EXAM_MARKS' }
      },
      {
        path: 'report-card',
        loadComponent: () => import('./components/report-card/report-card.component').then(m => m.ReportCardComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN'], featureKey: 'REPORT_CARD' }
      },
      {
        path: 'report-card-gallery',
        loadComponent: () => import('./components/report-card-demo/report-card-demo.component').then(m => m.ReportCardDemoComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'REPORT_CARD' }
      },

      // ── Student Dashboard ────────────────────────────────────────────
      {
        path: 'student-dashboard',
        loadComponent: () => import('./components/student-dashboard/student-dashboard.component').then(m => m.StudentDashboardComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT'] }
      },

      // ── Teacher Dashboard ────────────────────────────────────────────
      {
        path: 'teacher-dashboard',
        loadComponent: () => import('./components/teacher-dashboard/teacher-dashboard.component').then(m => m.TeacherDashboardComponent),
        canActivate: [roleGuard], data: { roles: ['TEACHER'] }
      },

      // ── Admin Dashboard ───────────────────────────────────────────────
      {
        path: 'admin-dashboard',
        loadComponent: () => import('./components/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [roleGuard], data: { roles: ['ADMIN', 'SUB_ADMIN'] }
      },

      // ── Analytics Dashboard ───────────────────────────────────────────
      {
        path: 'analytics',
        loadComponent: () => import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent),
        canActivate: [roleGuard, featureGuard], data: { roles: ['ADMIN'], featureKey: 'ANALYTICS' }
      },

      // ── Timetable ─────────────────────────────────────────────────────
      {
        path: 'timetable',
        loadComponent: () => import('./components/timetable/timetable.component').then(m => m.TimetableComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN'] }
      },

      // ── Open to all authenticated users ──────────────────────────────
      {
        path: 'notice',
        loadComponent: () => import('./components/notice/notice.component').then(m => m.NoticeComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN'] }
      },
      {
        path: 'event-calendar',
        loadComponent: () => import('./components/event-calendar/event-calendar.component').then(m => m.EventCalendarComponent),
        canActivate: [roleGuard], data: { roles: ['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN'] }
      },
      {
        path: 'payment',
        loadComponent: () => import('./components/payment/payment.component').then(m => m.PaymentComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: ['STUDENT', 'ADMIN'], featureKey: 'PAYMENT_COLLECTION' }
      },
    ],
  },

  { path: '**', redirectTo: '/home', pathMatch: 'full' },
];

export const AppRoutingModule = {
  provideRouter: () => provideRouter(routes),
};
