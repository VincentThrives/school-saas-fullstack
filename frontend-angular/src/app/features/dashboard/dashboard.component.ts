import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface DashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalUsers: number;
  totalTenants?: number;
  totalClasses?: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dashboard-container">
      <h1 class="page-title">Dashboard</h1>

      <div *ngIf="loading" class="loading-wrapper">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <div *ngIf="!loading" class="stats-grid">
        <mat-card *ngIf="isSuperAdmin" class="stat-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-row">
              <div class="stat-info">
                <span class="stat-label">Total Tenants</span>
                <span class="stat-value">{{ data?.totalTenants ?? 0 }}</span>
              </div>
              <div class="stat-icon-wrapper purple">
                <mat-icon>business</mat-icon>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-row">
              <div class="stat-info">
                <span class="stat-label">Total Students</span>
                <span class="stat-value">{{ data?.totalStudents ?? 0 }}</span>
              </div>
              <div class="stat-icon-wrapper gold">
                <mat-icon>school</mat-icon>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-row">
              <div class="stat-info">
                <span class="stat-label">Total Teachers</span>
                <span class="stat-value">{{ data?.totalTeachers ?? 0 }}</span>
              </div>
              <div class="stat-icon-wrapper blue">
                <mat-icon>person</mat-icon>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-row">
              <div class="stat-info">
                <span class="stat-label">Total Users</span>
                <span class="stat-value">{{ data?.totalUsers ?? 0 }}</span>
              </div>
              <div class="stat-icon-wrapper green">
                <mat-icon>group</mat-icon>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div *ngIf="error" class="error-banner">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-title { font-size: 28px; font-weight: 600; margin-bottom: 24px; color: #333; }
    .loading-wrapper { display: flex; justify-content: center; padding: 64px 0; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 20px;
    }
    .stat-card { border-radius: 12px; transition: box-shadow 0.2s; }
    .stat-card:hover { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); }
    .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
    .stat-info { display: flex; flex-direction: column; gap: 4px; }
    .stat-label { font-size: 14px; color: #666; font-weight: 500; }
    .stat-value { font-size: 32px; font-weight: 700; color: #222; }
    .stat-icon-wrapper {
      width: 52px; height: 52px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    .stat-icon-wrapper mat-icon { font-size: 28px; width: 28px; height: 28px; color: #fff; }
    .stat-icon-wrapper.gold { background: #D4A843; }
    .stat-icon-wrapper.blue { background: #4285f4; }
    .stat-icon-wrapper.green { background: #34a853; }
    .stat-icon-wrapper.purple { background: #7c4dff; }
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 16px; background: #fdecea; color: #d32f2f; border-radius: 8px; margin-top: 24px;
    }
  `]
})
export class DashboardComponent implements OnInit {
  data: DashboardData | null = null;
  loading = true;
  error: string | null = null;
  isSuperAdmin = false;

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    this.isSuperAdmin = this.auth.isSuperAdmin;

    if (this.isSuperAdmin) {
      this.api.getGlobalStats().subscribe({
        next: (res) => { this.data = res.data; this.loading = false; },
        error: () => { this.error = 'Failed to load dashboard data.'; this.loading = false; }
      });
    } else {
      this.api.getDashboard().subscribe({
        next: (res) => { this.data = res.data; this.loading = false; },
        error: () => { this.error = 'Failed to load dashboard data.'; this.loading = false; }
      });
    }
  }
}
