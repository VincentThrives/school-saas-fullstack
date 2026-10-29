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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { downloadOrOpenBlob } from '../../../shared/utils/download';
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
    MatButtonToggleModule,
    MatTooltipModule,
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
  marksColumns = ['subjectName', 'score', 'grade', 'status'];
  isLoading = false;
  isLoadingFilters = true;
  hasSearched = false;

  // ── Final (scheme-weighted) mode ──────────────────────────────────────
  /** 'exam' = per-exam report (default). 'final' = scheme-weighted. */
  viewMode: 'exam' | 'final' = 'exam';
  /** Toggle on the rollup matrix: show raw numbers vs weighted. */
  rollupMode: 'weighted' | 'raw' = 'weighted';
  /** The Final DTO loaded from the backend. Null when the student's
   *  class+year has no active scheme — the UI hides the Final tab then. */
  finalCard: any = null;
  /** True once we've probed the Final endpoint at least once in this
   *  (year) context. Prevents a flash of "Final" tab before we know. */
  finalProbed = false;
  isLoadingFinal = false;

  /** Helpers for the premium Score column (mini progress bar). */
  pct(row: any): number {
    const max = Number(row?.maxMarks) || 0;
    const obt = Number(row?.marksObtained) || 0;
    if (max <= 0) return 0;
    return Math.round((obt / max) * 100);
  }

  /** Mini-bar color tracks the grade band so the row glance matches the pill. */
  pctColor(row: any): string {
    const g = (row?.grade || '').toString().toUpperCase();
    if (g === 'A+' || g === 'A') return '#22c55e';
    if (g === 'B+' || g === 'B') return '#3b82f6';
    if (g === 'C') return '#f59e0b';
    if (g === 'D') return '#f97316';
    if (g === 'F') return '#ef4444';
    const p = this.pct(row);
    if (p >= 80) return '#22c55e';
    if (p >= 60) return '#3b82f6';
    if (p >= 40) return '#f59e0b';
    if (p > 0) return '#f97316';
    return '#cbd5e1';
  }

  /** Treat per-subject passed=true when backend sends it; otherwise fall
   *  back to a 35% floor (matches the UI convention used in My Marks). */
  rowPassed(row: any): boolean {
    if (row?.passed === true) return true;
    if (row?.passed === false) return false;
    return this.pct(row) >= 35;
  }

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  /** Strip the subject suffix ("· Kannada", "— Math", "- Physics") from
   *  an exam.name so sibling-subject rows collapse into the same event
   *  name ("FA1 · Kannada" and "FA1 · Math" both become "FA1"). Mirrors
   *  the backend's examNamePrefix() helper so the student picker shows
   *  the same labels the teacher sees. */
  private examNamePrefix(e: any): string {
    const name = (e?.name || '').toString();
    if (name) {
      const seps = [' · ', ' — ', ' - '];
      let bestIdx = -1;
      for (const sep of seps) {
        const idx = name.indexOf(sep);
        if (idx > 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
      }
      return (bestIdx > 0 ? name.substring(0, bestIdx) : name).trim();
    }
    return (e?.examType || '').toString();
  }

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
        this.probeFinal();
      } else {
        this.isLoadingFilters = false;
        this.finalProbed = true;
      }
    });
  }

  onYearChange(): void {
    this.selectedExamType = '';
    this.reportCard = null;
    this.hasSearched = false;
    this.finalCard = null;
    this.finalProbed = false;
    this.loadExamTypesForYear();
    this.probeFinal();
  }

  onViewModeChange(): void {
    if (this.viewMode === 'final' && !this.finalCard) this.loadFinal();
  }

  /** Try to load the Final card once per year so we know whether to show
   *  the tab. A 200 + null payload (or a 404) tells us there's no scheme
   *  for this student's class in this year. */
  private probeFinal(): void {
    if (!this.selectedAcademicYearId) return;
    this.finalProbed = false;
    this.api.getMyFinalReportCard(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.finalCard = res?.data || null;
        this.finalProbed = true;
      },
      error: () => { this.finalCard = null; this.finalProbed = true; },
    });
  }

  loadFinal(): void {
    if (!this.selectedAcademicYearId) return;
    this.isLoadingFinal = true;
    this.api.getMyFinalReportCard(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.finalCard = res?.data || null;
        this.isLoadingFinal = false;
      },
      error: () => { this.finalCard = null; this.isLoadingFinal = false; },
    });
  }

  // ── Final-view helpers ───────────────────────────────────────────────

  slotStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'COMPLETED': return 'slot-pill--completed';
      case 'IN_PROGRESS': return 'slot-pill--inprogress';
      case 'PENDING': return 'slot-pill--pending';
      default: return 'slot-pill--pending';
    }
  }

  subjectCellStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'COMPLETED': return 'cell-pill--completed';
      case 'PENDING':   return 'cell-pill--pending';
      case 'ABSENT':    return 'cell-pill--absent';
      case 'NOT_SCHEDULED': return 'cell-pill--notsched';
      default: return 'cell-pill--pending';
    }
  }

  /** Width of the slot's mini progress bar (0..100). */
  slotPct(row: any): number {
    if (row?.percentage != null) return Math.max(0, Math.min(100, Number(row.percentage)));
    const max = Number(row?.rawMax || 0);
    const obt = Number(row?.rawObtained || 0);
    return max > 0 ? Math.round((obt / max) * 100) : 0;
  }

  /** Grand Total KPI formatting helper. */
  gtPercent(): number {
    return Number(this.finalCard?.grandTotal?.percentage || 0);
  }

  downloadFinalPdf(): void {
    if (!this.selectedAcademicYearId) return;
    const tenantId = this.auth.currentSchoolInfo?.tenantId || '';
    if (!tenantId) {
      this.snackBar.open('Tenant context missing — please re-login.', 'Close', { duration: 3000 });
      return;
    }
    this.api.downloadMyFinalReportCardPdf(this.selectedAcademicYearId, tenantId).subscribe({
      next: (blob) => downloadOrOpenBlob(blob, `final_report_card.pdf`),
      error: (err) => this.snackBar.open(err?.error?.message || 'Failed to download PDF', 'Close', { duration: 3000 }),
    });
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
        // Use the exam NAME PREFIX ("FA1", "FA2", "SA1" …) rather than
        // the broad examType ("FA", "SA") — matches the picker on
        // Report Cards + Class Rankings so students see the same labels
        // their teachers do, and so backend filtering (which treats the
        // examType param as a name prefix now) returns the right data.
        const types = new Set<string>();
        scoped.forEach((e: any) => {
          const n = this.examNamePrefix(e);
          if (n) types.add(n);
        });
        this.examTypeOptions = Array.from(types).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        this.isLoadingFilters = false;
        // Auto-select the first exam so the student lands on something
        // instead of an empty picker. Preserve any already-selected exam
        // when it's still in the new list (e.g. after a year change the
        // user re-triggered the fetch).
        if (this.examTypeOptions.length > 0 && !this.examTypeOptions.includes(this.selectedExamType)) {
          this.selectedExamType = this.examTypeOptions[0];
          this.loadReportCard();
        } else if (this.selectedExamType) {
          this.loadReportCard();
        }
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
        // downloadOrOpenBlob routes via base64+window.open inside the
        // Capacitor WebView (Android), since the legacy anchor-click
        // trick silently no-ops on native. Plain browsers still get
        // the standard download anchor.
        downloadOrOpenBlob(blob, `report_card_${this.selectedExamType}.pdf`);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to download PDF', 'Close', { duration: 3000 });
      },
    });
  }
}
