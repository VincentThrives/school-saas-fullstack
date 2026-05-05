import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models';
import { StudentProfileComponent } from '../student-profile/student-profile.component';
import { EmployeeProfileComponent } from '../employee-profile/employee-profile.component';
import { AdminProfileComponent } from '../admin-profile/admin-profile.component';
import { RouterLink } from '@angular/router';

/**
 * Single `/profile` route shell. Reads the logged-in user's role and
 * renders the matching profile sub-component. SUPER_ADMIN gets a friendly
 * empty-state pointing them at the Tenants page (their identity isn't
 * managed per-school).
 *
 * One sidebar entry → consistent URL → no per-role guard duplication.
 */
@Component({
  selector: 'app-profile-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    StudentProfileComponent,
    EmployeeProfileComponent,
    AdminProfileComponent,
  ],
  template: `
    <ng-container [ngSwitch]="role">
      <app-student-profile  *ngSwitchCase="'STUDENT'"></app-student-profile>
      <app-employee-profile *ngSwitchCase="'TEACHER'"></app-employee-profile>
      <app-employee-profile *ngSwitchCase="'PRINCIPAL'"></app-employee-profile>
      <app-admin-profile    *ngSwitchCase="'SCHOOL_ADMIN'"></app-admin-profile>

      <!-- Super admin: profile lives on the platform, not per-tenant. -->
      <div class="empty-state" *ngSwitchCase="'SUPER_ADMIN'">
        <mat-icon>admin_panel_settings</mat-icon>
        <h3>Super Admin profile</h3>
        <p>Your account is platform-wide and isn't editable from a tenant context.</p>
        <a class="link" routerLink="/tenants">Go to Tenants</a>
      </div>

      <div class="empty-state" *ngSwitchDefault>
        <mat-icon>person_off</mat-icon>
        <h3>Profile unavailable</h3>
        <p>We couldn't determine your role. Please log out and back in.</p>
      </div>
    </ng-container>
  `,
  styles: [`
    .empty-state {
      max-width: 420px;
      margin: 80px auto;
      text-align: center;
      color: rgba(0, 0, 0, 0.6);
      padding: 32px;

      mat-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: rgba(0, 0, 0, 0.25);
        margin-bottom: 12px;
      }
      h3 { margin: 0 0 8px; font-size: 1.1rem; color: #1a1a1a; }
      p  { margin: 0 0 16px; font-size: 0.9rem; }
      .link {
        color: #B8860B;
        text-decoration: none;
        font-weight: 600;
        &:hover { text-decoration: underline; }
      }
    }

    :host-context(body.dark-theme) .empty-state {
      color: rgba(255,255,255,0.6);
      mat-icon { color: rgba(255,255,255,0.25); }
      h3 { color: #f0f0f0; }
      .link { color: #E8C97A; }
    }
  `],
})
export class ProfileShellComponent implements OnInit {
  role = '';

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    const u = this.auth.currentUser;
    this.role = u?.role || '';
  }
}
