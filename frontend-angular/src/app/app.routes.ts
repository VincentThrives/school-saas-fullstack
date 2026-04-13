import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { featureGuard } from './core/guards/feature.guard';
import { UserRole } from './core/models';

export const routes: Routes = [
  // ── Public Auth Routes ──────────────────────────────────
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/school-id/school-id.component').then(m => m.SchoolIdComponent),
  },
  {
    path: 'login/credentials',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'superadmin',
    loadComponent: () =>
      import('./features/auth/super-admin-login/super-admin-login.component').then(m => m.SuperAdminLoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },

  // ── Protected Routes (with layout) ─────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      // Dashboard
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'superadmin/dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },

      // Users (SCHOOL_ADMIN only)
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users-list/users-list.component').then(m => m.UsersListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },
      {
        path: 'users/new',
        loadComponent: () =>
          import('./features/users/user-form/user-form.component').then(m => m.UserFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },
      {
        path: 'users/:userId/edit',
        loadComponent: () =>
          import('./features/users/user-form/user-form.component').then(m => m.UserFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },

      // Students
      {
        path: 'students',
        loadComponent: () =>
          import('./features/students/students-list/students-list.component').then(m => m.StudentsListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },
      {
        path: 'students/new',
        loadComponent: () =>
          import('./features/students/student-form/student-form.component').then(m => m.StudentFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },
      {
        path: 'students/:studentId/edit',
        loadComponent: () =>
          import('./features/students/student-form/student-form.component').then(m => m.StudentFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },

      // Teachers
      {
        path: 'teachers',
        loadComponent: () =>
          import('./features/teachers/teachers-list/teachers-list.component').then(m => m.TeachersListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },
      {
        path: 'teachers/new',
        loadComponent: () =>
          import('./features/teachers/teacher-form/teacher-form.component').then(m => m.TeacherFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },
      {
        path: 'teachers/:teacherId/edit',
        loadComponent: () =>
          import('./features/teachers/teacher-form/teacher-form.component').then(m => m.TeacherFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },

      // Subjects (SCHOOL_ADMIN only)
      {
        path: 'subjects',
        loadComponent: () =>
          import('./features/subjects/subjects-list/subjects-list.component').then(m => m.SubjectsListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },

      // Classes (SCHOOL_ADMIN only)
      {
        path: 'classes',
        loadComponent: () =>
          import('./features/classes/classes-list/classes-list.component').then(m => m.ClassesListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },
      {
        path: 'classes/new',
        loadComponent: () =>
          import('./features/classes/class-form/class-form.component').then(m => m.ClassFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },
      {
        path: 'classes/:classId/edit',
        loadComponent: () =>
          import('./features/classes/class-form/class-form.component').then(m => m.ClassFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },

      // Academic Years (SCHOOL_ADMIN only)
      {
        path: 'academic-years',
        loadComponent: () =>
          import('./features/academic-years/academic-years-list/academic-years-list.component').then(m => m.AcademicYearsListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },

      // ── Attendance (feature-gated) ───────────────────────
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/attendance/mark-attendance/mark-attendance.component').then(m => m.MarkAttendanceComponent),
        canActivate: [featureGuard],
        data: { feature: 'attendance' },
      },
      {
        path: 'attendance/mark',
        loadComponent: () =>
          import('./features/attendance/mark-attendance/mark-attendance.component').then(m => m.MarkAttendanceComponent),
        canActivate: [featureGuard],
        data: { feature: 'attendance' },
      },
      {
        path: 'attendance/subject-wise',
        loadComponent: () =>
          import('./features/attendance/mark-subject-attendance/mark-subject-attendance.component').then(m => m.MarkSubjectAttendanceComponent),
        canActivate: [featureGuard],
        data: { feature: 'attendance' },
      },
      {
        path: 'attendance/report',
        loadComponent: () =>
          import('./features/attendance/attendance-report/attendance-report.component').then(m => m.AttendanceReportComponent),
        canActivate: [featureGuard],
        data: { feature: 'attendance' },
      },
      {
        path: 'attendance/subject-report',
        loadComponent: () =>
          import('./features/attendance/subject-attendance-report/subject-attendance-report.component').then(m => m.SubjectAttendanceReportComponent),
        canActivate: [featureGuard],
        data: { feature: 'attendance' },
      },

      // ── Exams (feature-gated) ────────────────────────────
      {
        path: 'exams',
        loadComponent: () =>
          import('./features/exams/exams-list/exams-list.component').then(m => m.ExamsListComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },
      {
        path: 'exams/new',
        loadComponent: () =>
          import('./features/exams/exam-form/exam-form.component').then(m => m.ExamFormComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },
      {
        path: 'exams/:examId/edit',
        loadComponent: () =>
          import('./features/exams/exam-form/exam-form.component').then(m => m.ExamFormComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },
      {
        path: 'exams/:examId/results',
        loadComponent: () =>
          import('./features/exams/exam-results/exam-results.component').then(m => m.ExamResultsComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },
      {
        path: 'exams/:examId/marks',
        loadComponent: () =>
          import('./features/exams/enter-marks/enter-marks.component').then(m => m.EnterMarksComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },

      // ── Student Marks ─────────────────────────────────────
      {
        path: 'my-marks',
        loadComponent: () =>
          import('./features/exams/my-marks/my-marks.component').then(m => m.MyMarksComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },
      {
        path: 'child-marks',
        loadComponent: () =>
          import('./features/exams/child-marks/child-marks.component').then(m => m.ChildMarksComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },
      {
        path: 'exams/calendar',
        loadComponent: () =>
          import('./features/exams/exam-calendar/exam-calendar.component').then(m => m.ExamCalendarComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams' },
      },

      // ── MCQ (feature-gated) ──────────────────────────────
      {
        path: 'mcq',
        loadComponent: () =>
          import('./features/mcq/mcq-exams-list/mcq-exams-list.component').then(m => m.McqExamsListComponent),
        canActivate: [featureGuard],
        data: { feature: 'mcq' },
      },
      {
        path: 'mcq/questions',
        loadComponent: () =>
          import('./features/mcq/question-bank/question-bank.component').then(m => m.QuestionBankComponent),
        canActivate: [featureGuard],
        data: { feature: 'mcq' },
      },
      {
        path: 'mcq/available',
        loadComponent: () =>
          import('./features/mcq/available-mcq-exams/available-mcq-exams.component').then(m => m.AvailableMcqExamsComponent),
        canActivate: [featureGuard],
        data: { feature: 'mcq' },
      },
      {
        path: 'mcq/take/:examId',
        loadComponent: () =>
          import('./features/mcq/take-mcq-exam/take-mcq-exam.component').then(m => m.TakeMcqExamComponent),
        canActivate: [featureGuard],
        data: { feature: 'mcq' },
      },

      // Fees (feature-gated, SCHOOL_ADMIN)
      {
        path: 'fees',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN], feature: 'fee', title: 'Fee Management' },
      },

      // Events (feature-gated)
      {
        path: 'events',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [featureGuard],
        data: { feature: 'events', title: 'Events' },
      },

      // Notifications (feature-gated)
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [featureGuard],
        data: { feature: 'notifications', title: 'Notifications' },
      },

      // ── WhatsApp (feature-gated, staff only) ─────────────
      {
        path: 'whatsapp',
        loadComponent: () =>
          import('./features/whatsapp/whatsapp-history/whatsapp-history.component').then(m => m.WhatsappHistoryComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER], feature: 'whatsapp' },
      },
      {
        path: 'whatsapp/compose',
        loadComponent: () =>
          import('./features/whatsapp/whatsapp-compose/whatsapp-compose.component').then(m => m.WhatsappComposeComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER], feature: 'whatsapp' },
      },
      {
        path: 'whatsapp/:messageId',
        loadComponent: () =>
          import('./features/whatsapp/whatsapp-detail/whatsapp-detail.component').then(m => m.WhatsappDetailComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER], feature: 'whatsapp' },
      },

      // ── ID Card Generator ────────────────────────────────
      {
        path: 'id-cards',
        loadComponent: () =>
          import('./features/idcard/id-card-generator/id-card-generator.component').then(m => m.IdCardGeneratorComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },

      // ── Report Cards (feature-gated) ────────────────────
      {
        path: 'report-cards',
        loadComponent: () =>
          import('./features/report-cards/report-card-generator/report-card-generator.component').then(m => m.ReportCardGeneratorComponent),
        canActivate: [featureGuard],
        data: { feature: 'report_cards' },
      },
      {
        path: 'report-cards/:reportCardId',
        loadComponent: () =>
          import('./features/report-cards/report-card-view/report-card-view.component').then(m => m.ReportCardViewComponent),
        canActivate: [featureGuard],
        data: { feature: 'report_cards' },
      },

      // ── Syllabus Tracker ────────────────────────────────
      {
        path: 'syllabus',
        loadComponent: () =>
          import('./features/syllabus/syllabus-list/syllabus-list.component').then(m => m.SyllabusListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },
      {
        path: 'syllabus/new',
        loadComponent: () =>
          import('./features/syllabus/syllabus-form/syllabus-form.component').then(m => m.SyllabusFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },
      {
        path: 'syllabus/:syllabusId',
        loadComponent: () =>
          import('./features/syllabus/syllabus-detail/syllabus-detail.component').then(m => m.SyllabusDetailComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },
      {
        path: 'syllabus/:syllabusId/edit',
        loadComponent: () =>
          import('./features/syllabus/syllabus-form/syllabus-form.component').then(m => m.SyllabusFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },

      // ── Assignments ─────────────────────────────────────
      {
        path: 'assignments',
        loadComponent: () =>
          import('./features/assignments/assignments-list/assignments-list.component').then(m => m.AssignmentsListComponent),
      },
      {
        path: 'assignments/new',
        loadComponent: () =>
          import('./features/assignments/assignment-form/assignment-form.component').then(m => m.AssignmentFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },
      {
        path: 'assignments/:assignmentId',
        loadComponent: () =>
          import('./features/assignments/assignment-detail/assignment-detail.component').then(m => m.AssignmentDetailComponent),
      },
      {
        path: 'assignments/:assignmentId/edit',
        loadComponent: () =>
          import('./features/assignments/assignment-form/assignment-form.component').then(m => m.AssignmentFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },

      // ── Performance Analytics (feature-gated) ───────────
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/performance-dashboard/performance-dashboard.component').then(m => m.PerformanceDashboardComponent),
        canActivate: [featureGuard],
        data: { feature: 'analytics' },
      },
      {
        path: 'analytics/rankings',
        loadComponent: () =>
          import('./features/analytics/class-rankings/class-rankings.component').then(m => m.ClassRankingsComponent),
        canActivate: [featureGuard],
        data: { feature: 'analytics' },
      },
      {
        path: 'analytics/student/:studentId',
        loadComponent: () =>
          import('./features/analytics/student-report/student-report.component').then(m => m.StudentReportComponent),
        canActivate: [featureGuard],
        data: { feature: 'analytics' },
      },

      // ── PTM (Parent-Teacher Meetings) ───────────────────
      {
        path: 'ptm',
        loadComponent: () =>
          import('./features/ptm/ptm-list/ptm-list.component').then(m => m.PtmListComponent),
      },
      {
        path: 'ptm/new',
        loadComponent: () =>
          import('./features/ptm/ptm-create/ptm-create.component').then(m => m.PtmCreateComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },
      {
        path: 'ptm/:ptmId/book',
        loadComponent: () =>
          import('./features/ptm/ptm-book/ptm-book.component').then(m => m.PtmBookComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.PARENT] },
      },
      {
        path: 'ptm/:ptmId/schedule',
        loadComponent: () =>
          import('./features/ptm/ptm-schedule/ptm-schedule.component').then(m => m.PtmScheduleComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },

      // Timetable (feature-gated)
      {
        path: 'timetable',
        loadComponent: () =>
          import('./features/timetable/timetable-list/timetable-list.component').then(m => m.TimetableListComponent),
        canActivate: [featureGuard],
        data: { feature: 'timetable' },
      },
      {
        path: 'timetable/builder',
        loadComponent: () =>
          import('./features/timetable/timetable-builder/timetable-builder.component').then(m => m.TimetableBuilderComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL], feature: 'timetable' },
      },
      {
        path: 'timetable/view',
        loadComponent: () =>
          import('./features/timetable/timetable-view/timetable-view.component').then(m => m.TimetableViewComponent),
        canActivate: [featureGuard],
        data: { feature: 'timetable' },
      },

      // Settings (SCHOOL_ADMIN only)
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN], title: 'Settings' },
      },

      // ── Additional Placeholder Routes ──────────────────────
      {
        path: 'messages',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Messages' },
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Reports' },
      },
      {
        path: 'my-classes',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'My Classes' },
      },
      {
        path: 'my-students',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'My Students' },
      },
      {
        path: 'mentoring',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Mentoring' },
      },
      {
        path: 'study-materials',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Study Materials' },
      },
      {
        path: 'children',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Children' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        data: { title: 'Profile' },
      },

      // Super Admin routes - Tenant Management
      {
        path: 'superadmin/tenants',
        loadComponent: () =>
          import('./features/tenants/tenants-list/tenants-list.component').then(m => m.TenantsListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },
      {
        path: 'superadmin/tenants/new',
        loadComponent: () =>
          import('./features/tenants/tenant-form/tenant-form.component').then(m => m.TenantFormComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },
      {
        path: 'superadmin/tenants/:tenantId',
        loadComponent: () =>
          import('./features/tenants/tenant-detail/tenant-detail.component').then(m => m.TenantDetailComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },

      // Feature Management (Super Admin)
      {
        path: 'superadmin/features',
        loadComponent: () =>
          import('./features/feature-management/school-selector/school-selector.component').then(m => m.SchoolSelectorComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },
      {
        path: 'superadmin/features/:tenantId',
        loadComponent: () =>
          import('./features/feature-management/school-features/school-features.component').then(m => m.SchoolFeaturesComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },
      {
        path: 'superadmin/features/:tenantId/audit',
        loadComponent: () =>
          import('./features/feature-management/feature-audit-log/feature-audit-log.component').then(m => m.FeatureAuditLogComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },
      {
        path: 'superadmin/templates',
        loadComponent: () =>
          import('./features/feature-management/feature-templates/feature-templates.component').then(m => m.FeatureTemplatesComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },

      {
        path: 'superadmin/audit-logs',
        loadComponent: () =>
          import('./features/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },
      {
        path: 'superadmin/settings',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN], title: 'Super Admin Settings' },
      },
    ],
  },

  // Wildcard → login
  { path: '**', redirectTo: 'login' },
];
