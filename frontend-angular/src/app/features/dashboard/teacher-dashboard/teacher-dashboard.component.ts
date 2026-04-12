import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatTableModule,
    MatButtonModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.scss',
})
export class TeacherDashboardComponent {
  stats = {
    assignedClasses: 4,
    assignedStudents: 120,
    pendingAttendance: true,
    recentMessages: 3,
  };

  todaySchedule = [
    { periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectName: 'Mathematics', className: 'Grade 10', sectionName: 'A', room: 'Room 101' },
    { periodNumber: 2, startTime: '08:45', endTime: '09:30', subjectName: 'Mathematics', className: 'Grade 9', sectionName: 'B', room: 'Room 102' },
    { periodNumber: 3, startTime: '09:45', endTime: '10:30', subjectName: 'Mathematics', className: 'Grade 10', sectionName: 'B', room: 'Room 101' },
    { periodNumber: 4, startTime: '10:30', endTime: '11:15', subjectName: 'Mathematics', className: 'Grade 8', sectionName: 'A', room: 'Room 103' },
    { periodNumber: 6, startTime: '12:00', endTime: '12:45', subjectName: 'Mathematics', className: 'Grade 9', sectionName: 'A', room: 'Room 102' },
  ];

  classesNeedingAttendance = [
    { className: 'Grade 10', sectionName: 'A', period: '1st Period' },
    { className: 'Grade 9', sectionName: 'B', period: '2nd Period' },
  ];

  upcomingExams = [
    { name: 'Mid-Term Test', class: 'Grade 10-A', date: '2024-03-15', subject: 'Mathematics' },
    { name: 'Unit Test 2', class: 'Grade 9-B', date: '2024-03-18', subject: 'Mathematics' },
  ];

  scheduleColumns = ['period', 'time', 'class', 'subject', 'room', 'attendance'];
}
