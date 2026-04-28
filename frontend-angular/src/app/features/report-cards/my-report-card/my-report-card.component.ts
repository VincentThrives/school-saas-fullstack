import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-my-report-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-report-card.component.html',
  styleUrl: './my-report-card.component.scss',
})
export class MyReportCardComponent implements OnInit {
  // Filters — class+section come from the student's record, NOT the UI.
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  /** Exam types that exist in the selected year for the student's class+section. */
  examTypeOptions: string[] = [];
  selectedExamType = '';

  /** Student's own class+section, resolved from /students/me on init. */
  private myClassId = '';
  private mySectionId = '';

  reportCard: any = null;
  marksColumns = ['subjectName', 'marksObtained', 'maxMarks', 'grade'];
  isLoading = false;
  isLoadingFilters = true;
  hasSearched = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    forkJoin({
      profile: this.api.getMyStudentProfile().pipe(catchError(() => of({ data: null } as any))),
      years: this.api.getAcademicYears().pipe(catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ profile, years }) => {
      const s = profile?.data as any;
      this.myClassId = s?.classId || '';
      this.mySectionId = s?.sectionId || '';

      this.academicYears = (years?.data as any[]) || [];
      const current = this.academicYears.find((y) => y.current) || this.academicYears[0];
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.loadExamTypesForYear();
      } else {
        this.isLoadingFilters = false;
      }
    });
  }

  onYearChange(): void {
    this.selectedExamType = '';
    this.reportCard = null;
    this.hasSearched = false;
    this.loadExamTypesForYear();
  }

  onExamTypeChange(): void {
    if (this.selectedExamType) this.loadReportCard();
    else { this.reportCard = null; this.hasSearched = false; }
  }

  /** Build the exam-type options from exams in the selected year that match
   *  the student's class+section. Resets when year changes. */
  private loadExamTypesForYear(): void {
    if (!this.selectedAcademicYearId) {
      this.examTypeOptions = [];
      this.isLoadingFilters = false;
      return;
    }
    this.isLoadingFilters = true;
    this.api.getExams({ academicYearId: this.selectedAcademicYearId }).subscribe({
      next: (res) => {
        const exams = (res?.data as any[]) || [];
        const scoped = exams.filter((e: any) => {
          if (!this.myClassId) return true;
          if (e?.classId && e.classId !== this.myClassId) return false;
          if (e?.sectionId && this.mySectionId && e.sectionId !== this.mySectionId) return false;
          return true;
        });
        const types = new Set<string>();
        scoped.forEach((e: any) => { if (e?.examType) types.add(e.examType); });
        this.examTypeOptions = Array.from(types).sort();
        this.isLoadingFilters = false;
      },
      error: () => { this.examTypeOptions = []; this.isLoadingFilters = false; },
    });
  }

  loadReportCard(): void {
    if (!this.selectedAcademicYearId || !this.selectedExamType) return;
    this.isLoading = true;
    this.hasSearched = true;
    this.api.getMyReportCard(this.selectedAcademicYearId, this.selectedExamType).subscribe({
      next: (res) => {
        this.reportCard = res?.data || null;
        this.isLoading = false;
      },
      error: (err) => {
        this.reportCard = null;
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to load report card', 'Close', { duration: 3000 });
      },
    });
  }

  downloadPdf(): void {
    if (!this.selectedAcademicYearId || !this.selectedExamType) return;
    const tenantId = this.auth.currentSchoolInfo?.tenantId || '';
    if (!tenantId) {
      this.snackBar.open('Tenant context missing — please re-login.', 'Close', { duration: 3000 });
      return;
    }
    this.api.downloadMyReportCardPdf(this.selectedAcademicYearId, tenantId, this.selectedExamType).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_card_${this.selectedExamType}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to download PDF', 'Close', { duration: 3000 });
      },
    });
  }
}
