import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatTableModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './parent-dashboard.component.html',
  styleUrl: './parent-dashboard.component.scss',
})
export class ParentDashboardComponent {
  selectedChild = 'child1';

  children = [
    { id: 'child1', name: 'Rahul Sharma', class: '10-A' },
    { id: 'child2', name: 'Priya Sharma', class: '8-B' },
  ];

  stats = {
    childAttendance: { percentage: 94.5, presentDays: 85, absentDays: 5, totalDays: 90 },
    feeStatus: { totalDue: 25000, totalPaid: 20000, outstanding: 5000 },
  };

  recentMarks = [
    { exam: 'Mid-Term Math', marks: 45, total: 50, grade: 'A', date: '2024-03-10' },
    { exam: 'Science Quiz', marks: 18, total: 20, grade: 'A', date: '2024-03-08' },
    { exam: 'English Essay', marks: 38, total: 50, grade: 'B+', date: '2024-03-05' },
  ];

  upcomingEvents = [
    { title: 'Parent-Teacher Meeting', date: '2024-03-16', type: 'ACADEMIC' },
    { title: 'Sports Day', date: '2024-03-22', type: 'SPORTS' },
    { title: 'Annual Function', date: '2024-03-28', type: 'CULTURAL' },
  ];

  marksColumns = ['exam', 'date', 'marks', 'grade'];

  get hasPendingFees(): boolean {
    return this.stats.feeStatus.outstanding > 0;
  }

  isGradeA(grade: string): boolean {
    return grade.startsWith('A');
  }
}
