import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-principal-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatTableModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './principal-dashboard.component.html',
  styleUrl: './principal-dashboard.component.scss',
})
export class PrincipalDashboardComponent {
  stats = {
    attendanceRateToday: 94.2,
    attendanceRateMonth: 92.8,
    feeCollectionRate: 78,
    teacherComplianceRate: 96,
  };

  topPerformers = [
    { name: 'Rahul Sharma', class: '10-A', percentage: 98.5 },
    { name: 'Priya Singh', class: '10-B', percentage: 97.2 },
    { name: 'Amit Kumar', class: '9-A', percentage: 96.8 },
    { name: 'Sneha Patel', class: '10-A', percentage: 96.5 },
    { name: 'Vikram Reddy', class: '9-B', percentage: 95.9 },
  ];

  lowPerformers = [
    { name: 'Student A', class: '8-B', percentage: 42.5, attendance: 65 },
    { name: 'Student B', class: '7-A', percentage: 45.2, attendance: 72 },
    { name: 'Student C', class: '9-C', percentage: 48.8, attendance: 68 },
  ];

  upcomingExams = [
    { name: 'Final Exams - Grade 10', date: '2024-03-25', classes: 4 },
    { name: 'Unit Test - Grade 9', date: '2024-03-20', classes: 3 },
    { name: 'Mid-Term - Grade 8', date: '2024-03-22', classes: 3 },
  ];

  topDisplayedColumns = ['rank', 'name', 'class', 'percentage'];
  lowDisplayedColumns = ['name', 'class', 'marks', 'attendance'];
}
