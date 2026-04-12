import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-school-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './school-admin-dashboard.component.html',
  styleUrl: './school-admin-dashboard.component.scss',
})
export class SchoolAdminDashboardComponent implements OnInit {
  stats: any = {
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    attendanceRateToday: 0,
    feeCollectionThisMonth: 0,
    pendingFees: 0,
  };

  upcomingExams = [
    { name: 'Mid-Term Math', date: '2024-03-15', subjectName: 'Mathematics' },
    { name: 'Science Test', date: '2024-03-18', subjectName: 'Science' },
    { name: 'English Exam', date: '2024-03-20', subjectName: 'English' },
  ];

  upcomingEvents = [
    { title: 'Parent-Teacher Meeting', startDate: '2024-03-16', type: 'ACADEMIC' },
    { title: 'Sports Day', startDate: '2024-03-22', type: 'SPORTS' },
    { title: 'Annual Function', startDate: '2024-03-28', type: 'CULTURAL' },
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.apiService.getDashboard().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.stats = { ...this.stats, ...res.data };
        }
      },
      error: () => {
        this.stats = {
          totalStudents: 1250,
          totalTeachers: 65,
          totalClasses: 24,
          attendanceRateToday: 92.5,
          feeCollectionThisMonth: 450000,
          pendingFees: 125000,
        };
      },
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }
}
