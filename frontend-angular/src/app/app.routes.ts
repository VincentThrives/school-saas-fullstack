import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },

  // Students
  {
    path: 'students',
    loadComponent: () =>
      import('./features/students/students-list.component').then(m => m.StudentsListComponent),
  },

  // Users
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users/users-list.component').then(m => m.UsersListComponent),
  },

  // Teachers
  {
    path: 'teachers',
    loadComponent: () =>
      import('./features/teachers/teachers-list.component').then(m => m.TeachersListComponent),
  },

  // Classes
  {
    path: 'classes',
    loadComponent: () =>
      import('./features/classes/classes-list.component').then(m => m.ClassesListComponent),
  },

  // WhatsApp
  {
    path: 'whatsapp',
    loadComponent: () =>
      import('./features/whatsapp/whatsapp-history.component').then(m => m.WhatsappHistoryComponent),
  },
  {
    path: 'whatsapp/compose',
    loadComponent: () =>
      import('./features/whatsapp/whatsapp-compose.component').then(m => m.WhatsappComposeComponent),
  },
  {
    path: 'whatsapp/:messageId',
    loadComponent: () =>
      import('./features/whatsapp/whatsapp-detail.component').then(m => m.WhatsappDetailComponent),
  },

  // Placeholder pages for unimplemented features
  {
    path: 'timetable',
    loadComponent: () =>
      import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Timetable' },
  },
  {
    path: 'fees',
    loadComponent: () =>
      import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Fees' },
  },
  {
    path: 'events',
    loadComponent: () =>
      import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Events' },
  },
  {
    path: 'attendance',
    loadComponent: () =>
      import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Attendance' },
  },
  {
    path: 'exams',
    loadComponent: () =>
      import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Exams' },
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Notifications' },
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Settings' },
  },

  // Wildcard
  { path: '**', redirectTo: 'dashboard' },
];
