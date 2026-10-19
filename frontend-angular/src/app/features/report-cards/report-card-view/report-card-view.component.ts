import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { downloadOrOpenBlob } from '../../../shared/utils/download';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-report-card-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './report-card-view.component.html',
  styleUrl: './report-card-view.component.scss',
})
export class ReportCardViewComponent implements OnInit {
  reportCard: any = null;
  marksColumns = ['subjectName', 'score', 'grade'];

  /** Percent of max for a mark row — used by the mini progress-bar in
   *  the Score column. Null-safe for Absent / Not-Scheduled rows (max=0). */
  pct(mark: any): number {
    if (!mark || !mark.maxMarks) return 0;
    const p = (mark.marksObtained / mark.maxMarks) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  }

  /** Color band for the progress-bar fill. Mirrors the grade-pill palette
   *  so the eye catches "red = failing, green = top" at a glance. */
  pctColor(mark: any): string {
    if (!mark || mark.absent || mark.notScheduled) return '#e5e7eb';
    const p = this.pct(mark);
    if (p >= 85) return '#22c55e';     // A+/A — green
    if (p >= 70) return '#3b82f6';     // B+/B — blue
    if (p >= 55) return '#f59e0b';     // C    — amber
    if (p >= 35) return '#f97316';     // D    — orange
    return '#ef4444';                   // F    — red
  }
  isLoading = false;
  selectedExamType = '';
  selectedAcademicYearId = '';
  missingContext = false;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private location: Location,
    private snackBar: MatSnackBar,
  ) {}

  /**
   * Back to the Report Cards list. Uses Location.back() so the URL —
   * including the ?ay=&classId=&sectionId=&examType= query params the
   * generator now serialises — restores intact. Falls back to a fresh
   * navigation when there's no history to walk (deep-linked tab).
   */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.location.replaceState('/report-cards');
      window.location.href = '/report-cards';
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('reportCardId') || '';
    // Read context from query params set by the generator when "View" was clicked.
    this.selectedExamType = this.route.snapshot.queryParamMap.get('examType') || '';
    this.selectedAcademicYearId = this.route.snapshot.queryParamMap.get('academicYearId') || '';

    if (!id) {
      this.missingContext = true;
      return;
    }
    if (!this.selectedExamType) {
      // Can't show a meaningful card without an exam type.
      this.missingContext = true;
      return;
    }
    if (this.selectedAcademicYearId) {
      this.loadReportCard(id);
    } else {
      this.resolveCurrentYearAndLoad(id);
    }
  }

  private resolveCurrentYearAndLoad(studentId: string): void {
    this.api.getAcademicYears().subscribe({
      next: (ayRes) => {
        const years = Array.isArray(ayRes.data) ? ayRes.data : (ayRes.data as any)?.content || [];
        const current = years.find((y: any) => y.current);
        this.selectedAcademicYearId = current?.academicYearId || (years.length > 0 ? years[0].academicYearId : '');
        if (!this.selectedAcademicYearId) {
          this.snackBar.open('No academic year found', 'Close', { duration: 3000 });
          return;
        }
        this.loadReportCard(studentId);
      },
    });
  }

  loadReportCard(studentId: string): void {
    this.isLoading = true;
    this.api.getStudentReportCard(studentId, this.selectedAcademicYearId, this.selectedExamType).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.reportCard = res.data;
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to load report card', 'Close', { duration: 3000 });
      },
    });
  }

  downloadPdf(): void {
    if (!this.reportCard) return;
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';
    this.api.downloadReportCardPdf(this.reportCard.studentId, this.reportCard.academicYearId, tenantId, this.selectedExamType).subscribe({
      next: (blob) => {
        // Capacitor-safe download path (see shared/utils/download.ts).
        downloadOrOpenBlob(blob, `report-card-${this.reportCard.studentName || 'student'}.pdf`);
      },
      error: () => {
        this.snackBar.open('Failed to download PDF', 'Close', { duration: 3000 });
      },
    });
  }
}
