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
        path: 'attendance/report',
        loadComponent: () =>
          import('./features/attendance/attendance-report/attendance-report.component').then(m => m.AttendanceReportComponent),
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
        path: 'exams/:examId/marks',
        loadComponent: () =>
          import('./features/exams/enter-marks/enter-marks.component').then(m => m.EnterMarksComponent),
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

      // Timetable (feature-gated)
      {
        path: 'timetable',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [featureGuard],
        data: { feature: 'timetable', title: 'Timetable' },
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

      // Super Admin routes
      {
        path: 'superadmin/tenants',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN], title: 'Tenants' },
      },

      // Feature Management (Super Admin)
      {
        path: 'superadmin/features',
        loadComponent: () =>
          import('./features/feature-management/school-features/school-features.component').then(m => m.SchoolFeaturesComponent),
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
