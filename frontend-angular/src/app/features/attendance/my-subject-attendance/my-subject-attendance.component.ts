import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface DayEntry {
  date: string;
  periodNumber: number;
  status: string;
  remarks?: string;
}

interface Detail {
  subjectId: string;
  subjectName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
  entries: DayEntry[];
}

@Component({
  selector: 'app-my-subject-attendance',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-subject-attendance.component.html',
  styleUrl: './my-subject-attendance.component.scss',
})
export class MySubjectAttendanceComponent implements OnInit {
  isLoading = true;
  detail: Detail | null = null;
  notFound = false;

  displayedColumns = ['date', 'periodNumber', 'status', 'remarks'];

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const subjectId = this.route.snapshot.paramMap.get('subjectId') || '';
    if (!subjectId) { this.isLoading = false; this.notFound = true; return; }
    this.api.getMySubjectAttendance(subjectId).subscribe({
      next: (res) => {
        this.detail = (res?.data as Detail) || null;
        this.isLoading = false;
        if (!this.detail) this.notFound = true;
      },
      error: () => { this.isLoading = false; this.notFound = true; },
    });
  }

  percentClass(p: number): string {
    if (p >= 75) return 'pct-good';
    if (p >= 60) return 'pct-warn';
    return 'pct-bad';
  }

  statusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PRESENT':  return 'st-present';
      case 'ABSENT':   return 'st-absent';
      case 'LATE':     return 'st-late';
      case 'HALF_DAY': return 'st-late';
      default:         return '';
    }
  }
}
