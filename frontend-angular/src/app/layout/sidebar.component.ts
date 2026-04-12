import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../core/services/auth.service';
import { UserRole } from '../core/models';

interface MenuItem {
  title: string;
  path: string;
  icon: string;
  roles?: UserRole[];
  feature?: string;
}

const SUPER_ADMIN_MENU: MenuItem[] = [
  { title: 'Dashboard', path: '/superadmin/dashboard', icon: 'dashboard' },
  { title: 'Tenants', path: '/superadmin/tenants', icon: 'business' },
  { title: 'Feature Flags', path: '/superadmin/features', icon: 'toggle_on' },
  { title: 'Settings', path: '/superadmin/settings', icon: 'settings' },
];

const SCHOOL_MENU: MenuItem[] = [
  { title: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  {
    title: 'Users',
    path: '/users',
    icon: 'people',
    roles: [UserRole.SCHOOL_ADMIN],
  },
  { title: 'Students', path: '/students', icon: 'school' },
  { title: 'Teachers', path: '/teachers', icon: 'person' },
  {
    title: 'Classes',
    path: '/classes',
    icon: 'class',
    roles: [UserRole.SCHOOL_ADMIN],
  },
  {
    title: 'Academic Years',
    path: '/academic-years',
    icon: 'date_range',
    roles: [UserRole.SCHOOL_ADMIN],
  },
  {
    title: 'Attendance',
    path: '/attendance',
    icon: 'event_note',
    feature: 'attendance',
  },
  {
    title: 'Exams',
    path: '/exams',
    icon: 'assignment',
    feature: 'exams',
  },
  {
    title: 'Fees',
    path: '/fees',
    icon: 'payment',
    feature: 'fee',
    roles: [UserRole.SCHOOL_ADMIN],
  },
  {
    title: 'Events',
    path: '/events',
    icon: 'event',
    feature: 'events',
  },
  {
    title: 'Notifications',
    path: '/notifications',
    icon: 'notifications',
    feature: 'notifications',
  },
  {
    title: 'WhatsApp',
    path: '/whatsapp',
    icon: 'chat',
    feature: 'whatsapp',
  },
  {
    title: 'Settings',
    path: '/settings',
    icon: 'settings',
    roles: [UserRole.SCHOOL_ADMIN],
  },
];

const TEACHER_MENU: MenuItem[] = [
  { title: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { title: 'My Students', path: '/my-students', icon: 'school' },
  {
    title: 'Attendance',
    path: '/attendance',
    icon: 'event_note',
    feature: 'attendance',
  },
  {
    title: 'Exams',
    path: '/exams',
    icon: 'assignment',
    feature: 'exams',
  },
  {
    title: 'WhatsApp',
    path: '/whatsapp',
    icon: 'chat',
    feature: 'whatsapp',
  },
  {
    title: 'Notifications',
    path: '/notifications',
    icon: 'notifications',
    feature: 'notifications',
  },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
  ],
  template: `
    <div class="sidebar-container">
      <div class="sidebar-brand">
        <mat-icon class="brand-icon">school</mat-icon>
        <span class="brand-text">SchoolSaaS</span>
      </div>

      <mat-divider></mat-divider>

      <mat-nav-list class="sidebar-nav">
        @for (item of visibleMenuItems; track item.path) {
          <a
            mat-list-item
            [routerLink]="item.path"
            routerLinkActive="active-link"
            [routerLinkActiveOptions]="{ exact: item.path.endsWith('dashboard') }"
            class="nav-item"
          >
            <mat-icon matListItemIcon class="nav-icon">{{ item.icon }}</mat-icon>
            <span matListItemTitle class="nav-title">{{ item.title }}</span>
          </a>
        }
      </mat-nav-list>
    </div>
  `,
  styles: `
    .sidebar-container {
      width: 260px;
      height: 100%;
      background-color: #1e1e2f;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      color: #D4A843;
    }

    .brand-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .brand-text {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    mat-divider {
      border-color: rgba(255, 255, 255, 0.08);
    }

    .sidebar-nav {
      padding: 8px 0;
      flex: 1;
    }

    .nav-item {
      margin: 2px 12px;
      border-radius: 8px !important;
      color: rgba(255, 255, 255, 0.7) !important;
      height: 44px !important;
      transition: all 0.2s ease;
    }

    .nav-item:hover {
      background-color: rgba(212, 168, 67, 0.1) !important;
      color: #ffffff !important;
    }

    .nav-icon {
      color: rgba(255, 255, 255, 0.5);
      margin-right: 12px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .nav-title {
      font-size: 14px;
      font-weight: 400;
    }

    .active-link {
      background-color: rgba(212, 168, 67, 0.15) !important;
      color: #D4A843 !important;
    }

    .active-link .nav-icon {
      color: #D4A843 !important;
    }

    .active-link .nav-title {
      font-weight: 500;
      color: #D4A843 !important;
    }
  `,
})
export class SidebarComponent {
  private authService = inject(AuthService);

  get visibleMenuItems(): MenuItem[] {
    const role = this.authService.currentRole;
    if (!role) return [];

    if (role === UserRole.SUPER_ADMIN) {
      return SUPER_ADMIN_MENU;
    }

    if (role === UserRole.TEACHER) {
      return TEACHER_MENU.filter((item) => this.isItemVisible(item));
    }

    // SCHOOL_ADMIN and PRINCIPAL
    return SCHOOL_MENU.filter((item) => this.isItemVisible(item));
  }

  private isItemVisible(item: MenuItem): boolean {
    // Check role restriction
    if (item.roles && item.roles.length > 0) {
      if (!this.authService.hasRole(...item.roles)) {
        return false;
      }
    }

    // Check feature flag
    if (item.feature) {
      if (!this.authService.isFeatureEnabled(item.feature)) {
        return false;
      }
    }

    return true;
  }
}
