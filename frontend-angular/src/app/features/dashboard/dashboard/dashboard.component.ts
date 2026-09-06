import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models';
import { SuperAdminDashboardComponent } from '../super-admin-dashboard/super-admin-dashboard.component';
import { SchoolAdminDashboardComponent } from '../school-admin-dashboard/school-admin-dashboard.component';
import { PrincipalDashboardComponent } from '../principal-dashboard/principal-dashboard.component';
import { TeacherDashboardComponent } from '../teacher-dashboard/teacher-dashboard.component';
import { StudentDashboardComponent } from '../student-dashboard/student-dashboard.component';
import { ParentDashboardComponent } from '../parent-dashboard/parent-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SuperAdminDashboardComponent,
    SchoolAdminDashboardComponent,
    PrincipalDashboardComponent,
    TeacherDashboardComponent,
    StudentDashboardComponent,
    ParentDashboardComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly UserRole = UserRole;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Safety net: this component's template ngSwitch has no case
    // for HR (HR has its own dashboard at /hr/dashboard with real
    // KPIs), so a bare /dashboard hit by an HR user would fall
    // through to the SCHOOL_ADMIN default. Bounce them to the
    // correct page immediately — the login flow and role switcher
    // already route HR to /hr/dashboard, this handles bookmarks,
    // manual URL edits, and back-navigation.
    if (this.currentRole === UserRole.HR && !this.isSuperAdmin) {
      this.router.navigateByUrl('/hr/dashboard', { replaceUrl: true });
    }
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin;
  }

  get currentRole(): UserRole | null {
    return this.authService.currentRole;
  }
}
