import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatProgressBarModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './super-admin-dashboard.component.html',
  styleUrl: './super-admin-dashboard.component.scss',
})
export class SuperAdminDashboardComponent implements OnInit {
  stats: any = {
    totalTenants: 0,
    activeTenants: 0,
    totalStudents: 0,
    totalUsers: 0,
    totalStorageUsedGb: 0,
    inactiveTenants: 0,
    suspendedTenants: 0,
  };

  recentTenants = [
    { tenantId: '1', schoolName: 'Greenwood Academy', lastLogin: '2 hours ago', activeUsers: 125 },
    { tenantId: '2', schoolName: "St. Mary's School", lastLogin: '5 hours ago', activeUsers: 89 },
    { tenantId: '3', schoolName: 'Delhi Public School', lastLogin: '1 day ago', activeUsers: 210 },
    { tenantId: '4', schoolName: 'Cambridge International', lastLogin: '2 days ago', activeUsers: 156 },
    { tenantId: '5', schoolName: 'National Academy', lastLogin: '3 days ago', activeUsers: 78 },
  ];

  systemHealth = [
    { label: 'API Response Time', value: '45ms avg', percentage: 85, color: 'success' },
    { label: 'Database Load', value: '62%', percentage: 62, color: 'warning' },
    { label: 'Storage Capacity', value: '256 GB / 1 TB', percentage: 25.6, color: 'primary' },
    { label: 'Uptime', value: '99.9%', percentage: 99.9, color: 'success' },
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.apiService.getGlobalStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.stats = { ...this.stats, ...res.data };
        }
      },
      error: () => {
        // Use default mock data
        this.stats = {
          totalTenants: 55,
          activeTenants: 45,
          totalStudents: 12500,
          totalUsers: 15420,
          totalStorageUsedGb: 256,
          inactiveTenants: 8,
          suspendedTenants: 2,
        };
      },
    });
  }

  getInitial(name: string): string {
    return name.charAt(0);
  }
}
