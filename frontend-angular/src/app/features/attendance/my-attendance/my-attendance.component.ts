import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { StudentProfileSummary } from '../../../core/models';

@Component({
  selector: 'app-my-attendance',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-attendance.component.html',
  styleUrl: './my-attendance.component.scss',
})
export class MyAttendanceComponent implements OnInit {
  isLoading = true;
  notFound = false;

  /** "DAY_WISE" or "SUBJECT_WISE" — drives which section is shown. */
  attendanceMode: 'DAY_WISE' | 'SUBJECT_WISE' = 'DAY_WISE';

  summary: StudentProfileSummary | null = null;

  subjectColumns = ['subjectName', 'present', 'absent', 'total', 'percentage', 'actions'];

  /** When non-null, the View detail panel is shown for this subject. */
  selectedSubject: any = null;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    // Load mode + summary in parallel
    this.api.getAttendanceMode().subscribe({
      next: (res) => {
        const m = (res?.data as any)?.mode;
        this.attendanceMode = m === 'SUBJECT_WISE' ? 'SUBJECT_WISE' : 'DAY_WISE';
      },
    });
    this.api.getMyProfileSummary().subscribe({
      next: (res) => {
        this.summary = res?.data || null;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; this.notFound = true; },
    });
  }

  percentClass(p: number): string {
    if (p >= 75) return 'pct-good';
    if (p >= 60) return 'pct-warn';
    return 'pct-bad';
  }

  /** Open the per-subject detail page (date-by-date breakdown). */
  viewSubject(row: any): void {
    if (!row?.subjectId) return;
    this.router.navigate(['/my-attendance', row.subjectId]);
  }
}
