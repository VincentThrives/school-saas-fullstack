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
      import('./features/auth/school-id.component').then(m => m.SchoolIdComponent),
  },
  {
    path: 'login/credentials',
    loadComponent: () =>
      import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'superadmin',
    loadComponent: () =>
      import('./features/auth/super-admin-login.component').then(m => m.SuperAdminLoginComponent),
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
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'superadmin/dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN] },
      },

      // Users (SCHOOL_ADMIN only)
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users-list.component').then(m => m.UsersListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },

      // Students
      {
        path: 'students',
        loadComponent: () =>
          import('./features/students/students-list.component').then(m => m.StudentsListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER] },
      },

      // Teachers
      {
        path: 'teachers',
        loadComponent: () =>
          import('./features/teachers/teachers-list.component').then(m => m.TeachersListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      },

      // Classes (SCHOOL_ADMIN only)
      {
        path: 'classes',
        loadComponent: () =>
          import('./features/classes/classes-list.component').then(m => m.ClassesListComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN] },
      },

      // Academic Years (SCHOOL_ADMIN only)
      {
        path: 'academic-years',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN], title: 'Academic Years' },
      },

      // Attendance (feature-gated)
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [featureGuard],
        data: { feature: 'attendance', title: 'Attendance' },
      },

      // Exams (feature-gated)
      {
        path: 'exams',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [featureGuard],
        data: { feature: 'exams', title: 'Exams' },
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

      // WhatsApp (feature-gated, staff only)
      {
        path: 'whatsapp',
        loadComponent: () =>
          import('./features/whatsapp/whatsapp-history.component').then(m => m.WhatsappHistoryComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER], feature: 'whatsapp' },
      },
      {
        path: 'whatsapp/compose',
        loadComponent: () =>
          import('./features/whatsapp/whatsapp-compose.component').then(m => m.WhatsappComposeComponent),
        canActivate: [roleGuard, featureGuard],
        data: { roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER], feature: 'whatsapp' },
      },
      {
        path: 'whatsapp/:messageId',
        loadComponent: () =>
          import('./features/whatsapp/whatsapp-detail.component').then(m => m.WhatsappDetailComponent),
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

      // Super Admin routes
      {
        path: 'superadmin/tenants',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN], title: 'Tenants' },
      },
      {
        path: 'superadmin/features',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.SUPER_ADMIN], title: 'Feature Flags' },
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
