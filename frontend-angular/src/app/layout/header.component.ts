import { Component, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../core/services/auth.service';
import { UserRole } from '../core/models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  template: `
    <mat-toolbar class="app-header">
      <button mat-icon-button (click)="toggleSidebar.emit()" aria-label="Toggle sidebar">
        <mat-icon>menu</mat-icon>
      </button>

      <span class="school-name">{{ schoolName }}</span>

      <span class="spacer"></span>

      <button mat-button [matMenuTriggerFor]="userMenu" class="user-menu-trigger">
        <div class="user-info">
          <div class="avatar">
            @if (user?.profilePhotoUrl) {
              <img [src]="user!.profilePhotoUrl" [alt]="displayName" class="avatar-img" />
            } @else {
              <mat-icon class="avatar-icon">account_circle</mat-icon>
            }
          </div>
          <span class="user-name">{{ displayName }}</span>
          <mat-icon class="dropdown-arrow">arrow_drop_down</mat-icon>
        </div>
      </button>

      <mat-menu #userMenu="matMenu" xPosition="before">
        <div class="menu-header" mat-menu-item disabled>
          <div class="menu-header-name">{{ displayName }}</div>
          <div class="menu-header-role">{{ roleBadge }}</div>
        </div>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="onLogout()">
          <mat-icon>logout</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: `
    .app-header {
      background-color: #1a1a2e;
      color: #ffffff;
      position: sticky;
      top: 0;
      z-index: 1000;
      height: 64px;
      padding: 0 16px;
      display: flex;
      align-items: center;
    }

    .school-name {
      font-size: 18px;
      font-weight: 500;
      margin-left: 8px;
      color: #D4A843;
    }

    .spacer {
      flex: 1;
    }

    .user-menu-trigger {
      color: #ffffff;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #D4A843;
    }

    .user-name {
      font-size: 14px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dropdown-arrow {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .menu-header {
      padding: 8px 16px;
    }

    .menu-header-name {
      font-weight: 500;
      font-size: 14px;
    }

    .menu-header-role {
      font-size: 12px;
      color: #D4A843;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `,
})
export class HeaderComponent {
  toggleSidebar = output<void>();

  private authService = inject(AuthService);

  get user() {
    return this.authService.currentUser;
  }

  get displayName(): string {
    const u = this.authService.currentUser;
    if (u) {
      return `${u.firstName} ${u.lastName}`.trim() || u.email;
    }
    return 'User';
  }

  get schoolName(): string {
    if (this.authService.isSuperAdmin) {
      return 'Admin Panel';
    }
    return this.authService.currentSchoolInfo?.schoolName ?? 'School Portal';
  }

  get roleBadge(): string {
    const role = this.authService.currentRole;
    if (!role) return '';
    return role.replace(/_/g, ' ');
  }

  onLogout(): void {
    this.authService.logout();
  }
}
