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
  selector: 'app-student-dashboard',
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
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.scss',
})
export class StudentDashboardComponent {
  stats = {
    attendancePercentage: 92.5,
    unreadNotifications: 5,
  };

  todaySchedule = [
    { periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectName: 'Mathematics', teacherName: 'Mr. Smith', room: 'Room 101' },
    { periodNumber: 2, startTime: '08:45', endTime: '09:30', subjectName: 'Science', teacherName: 'Mrs. Johnson', room: 'Lab 1' },
    { periodNumber: 3, startTime: '09:45', endTime: '10:30', subjectName: 'English', teacherName: 'Ms. Williams', room: 'Room 102' },
    { periodNumber: 4, startTime: '10:30', endTime: '11:15', subjectName: 'History', teacherName: 'Mr. Brown', room: 'Room 103' },
    { periodNumber: 5, startTime: '11:30', endTime: '12:15', subjectName: 'Geography', teacherName: 'Mrs. Davis', room: 'Room 104' },
    { periodNumber: 6, startTime: '12:15', endTime: '13:00', subjectName: 'Physical Ed', teacherName: 'Mr. Wilson', room: 'Ground' },
  ];

  recentMarks = [
    { exam: 'Math Unit Test', marks: 45, total: 50, grade: 'A' },
    { exam: 'Science Quiz', marks: 18, total: 20, grade: 'A' },
    { exam: 'English Essay', marks: 38, total: 50, grade: 'B+' },
  ];

  upcomingMcqExams = [
    { examId: '1', title: 'Math Chapter 5 Quiz', duration: 30, subjectName: 'Mathematics' },
    { examId: '2', title: 'Science MCQ Test', duration: 45, subjectName: 'Science' },
  ];

  scheduleColumns = ['period', 'time', 'subject', 'teacher', 'room'];

  isGoodAttendance(): boolean {
    return this.stats.attendancePercentage >= 75;
  }

  isGradeA(grade: string): boolean {
    return grade.startsWith('A');
  }
}
