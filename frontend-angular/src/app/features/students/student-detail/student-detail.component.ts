import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { StudentProfileSummary } from '../../../core/models';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressBarModule, MatProgressSpinnerModule, MatTabsModule,
    PageHeaderComponent,
  ],
  templateUrl: './student-detail.component.html',
  styleUrl: './student-detail.component.scss',
})
export class StudentDetailComponent implements OnInit {
  isLoading = true;
  notFound = false;
  summary: StudentProfileSummary | null = null;

  subjectColumns = ['subjectName', 'present', 'absent', 'total', 'percentage'];
  examColumns = ['examName', 'examDate', 'subjectName', 'marks', 'grade', 'status'];

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const studentId = this.route.snapshot.paramMap.get('studentId');
    if (!studentId) {
      this.isLoading = false;
      this.notFound = true;
      return;
    }
    this.api.getStudentProfileSummary(studentId).subscribe({
      next: (res) => {
        this.summary = res?.data || null;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.notFound = true;
      },
    });
  }

  back(): void {
    this.router.navigate(['/my-students']);
  }

  // ── helpers ──

  subtitleText(): string {
    const s = this.summary?.student;
    if (!s) return '';
    const cls = s.className || '';
    const sec = s.sectionName ? ' — ' + s.sectionName : '';
    const yr = s.academicYearLabel ? ' · ' + s.academicYearLabel : '';
    return `${cls}${sec}${yr}`;
  }

  initial(): string {
    const name = this.summary?.student?.name || '?';
    return name.charAt(0).toUpperCase();
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  }

  percentColor(p: number): 'primary' | 'accent' | 'warn' {
    if (p >= 75) return 'primary';
    if (p >= 60) return 'accent';
    return 'warn';
  }

  percentClass(p: number): string {
    if (p >= 75) return 'pct-good';
    if (p >= 60) return 'pct-warn';
    return 'pct-bad';
  }

  markPct(row: { marksObtained?: number; maxMarks: number }): number {
    if (!row.maxMarks || row.marksObtained == null) return 0;
    return Math.round((row.marksObtained / row.maxMarks) * 100);
  }

  markStatus(row: { marksObtained?: number; isPassed?: boolean }): 'PENDING' | 'PASSED' | 'FAILED' {
    if (row.marksObtained == null) return 'PENDING';
    return row.isPassed ? 'PASSED' : 'FAILED';
  }
}
