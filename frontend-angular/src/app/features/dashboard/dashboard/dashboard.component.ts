import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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
export class DashboardComponent {
  readonly UserRole = UserRole;

  constructor(private authService: AuthService) {}

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin;
  }

  get currentRole(): UserRole | null {
    return this.authService.currentRole;
  }
}
