import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';
import { AcademicYear } from '../../../core/models';

interface MarkRow {
  examName: string;
  examType: string;
  subjectId: string;
  subjectName: string;
  examDate: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
}

interface SubjectOption {
  subjectId: string;
  name: string;
}

@Component({
  selector: 'app-my-marks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-marks.component.html',
  styleUrl: './my-marks.component.scss',
})
export class MyMarksComponent implements OnInit {
  // Table state
  /** Year-scoped marks fetched from the backend, before subject filtering.
   *  Public so the template can show the right empty-state copy. */
  allMarks: MarkRow[] = [];
  /** What the table renders — `allMarks` filtered by `selectedSubjectIds`. */
  marks: MarkRow[] = [];
  examsMap: Record<string, any> = {};
  isLoading = false;
  isYearLoaded = false; // becomes true once the first year load finishes
  displayedColumns = ['examName', 'examType', 'subject', 'date', 'marks', 'percentage', 'grade', 'status'];

  // Filters
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  /** Subjects with at least one exam in the selected year (scoped to student's class+section). */
  subjectOptions: SubjectOption[] = [];
  /** Multi-select; empty array means "all subjects". */
  selectedSubjectIds: string[] = [];
  /** Exam types present in the selected year for the student's class+section. */
  examTypeOptions: string[] = [];
  /** Single-select; empty string means "all types". */
  selectedExamType = '';

  /** Cached student profile (classId/sectionId scope) — fetched once. */
  private myClassId = '';
  private mySectionId = '';
  private studentProfileLoaded = false;

  // Summary
  totalExams = 0;
  averagePercentage = 0;
  bestSubject = '-';
  overallGrade = '-';

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
  ) {}

  ngOnInit(): void {
    // Fetch the student's profile once — class/section scopes the visible exams.
    this.api.getMyStudentProfile().subscribe({
      next: (res) => {
        const s = res?.data as any;
        this.myClassId = s?.classId || '';
        this.mySectionId = s?.sectionId || '';
        this.studentProfileLoaded = true;
        // If the year load already ran (race), re-derive options now.
        if (this.allMarks.length > 0 || this.examsMap) this.recomputeYearScopedOptions();
      },
      error: () => { this.studentProfileLoaded = true; },
    });

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const list = (res.data as any[]) || [];
        this.academicYears = list;
        const current = list.find((y) => y.current) || list[0];
        if (current) {
          this.selectedAcademicYearId = current.academicYearId;
          this.loadForYear();
        } else {
          this.isYearLoaded = true;
        }
      },
      error: () => { this.isYearLoaded = true; },
    });
  }

  onYearChange(): void {
    // Reset subject + exam-type selections — last year's options don't apply.
    this.selectedSubjectIds = [];
    this.selectedExamType = '';
    this.loadForYear();
  }

  onSubjectsChange(): void {
    this.applyFilter();
  }

  onExamTypeChange(): void {
    this.applyFilter();
  }

  clearSubjects(): void {
    this.selectedSubjectIds = [];
    this.applyFilter();
  }

  clearExamType(): void {
    this.selectedExamType = '';
    this.applyFilter();
  }

  /** Load exams + marks for the selected academic year, then build the
   *  subject and exam-type options scoped to the student's class+section. */
  private loadForYear(): void {
    if (!this.selectedAcademicYearId) return;
    this.isLoading = true;
    forkJoin({
      exams: this.api.getExams({ academicYearId: this.selectedAcademicYearId }).pipe(catchError(() => of({ data: [] as any[] } as any))),
      marks: this.api.getMyMarks(this.selectedAcademicYearId).pipe(catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ exams, marks }) => {
      this.examsMap = {};
      const exList: any[] = (exams?.data as any[]) || [];
      exList.forEach((e: any) => { this.examsMap[e.examId] = e; });

      const scopedExams = this.scopeToStudent(exList);

      // Exam-type options — single-select.
      const types = new Set<string>();
      scopedExams.forEach((e: any) => { if (e?.examType) types.add(e.examType); });
      this.examTypeOptions = Array.from(types).sort();

      // Subject options — bulk-resolve names.
      const subjectIdSet = new Set<string>();
      scopedExams.forEach((e: any) => { if (e?.subjectId) subjectIdSet.add(e.subjectId); });
      const ids = Array.from(subjectIdSet);

      const finishWith = (subs: SubjectOption[]) => {
        this.subjectOptions = subs.sort((a, b) => a.name.localeCompare(b.name));
        this.allMarks = this.buildMarkRows((marks?.data as any[]) || []);
        this.applyFilter();
        this.isLoading = false;
        this.isYearLoaded = true;
      };

      if (ids.length > 0) {
        this.subjectService.getSubjectsByIds(ids).subscribe({
          next: (subs) => finishWith(subs.map((s) => ({ subjectId: s.subjectId, name: s.name }))),
          error: () => finishWith(ids.map((id) => ({ subjectId: id, name: id }))),
        });
      } else {
        finishWith([]);
      }
    });
  }

  /** Limit an exam list to those that belong to the student's class+section.
   *  Falls back to no scoping if the profile hasn't loaded yet (so options
   *  still appear; the marks themselves are already student-specific). */
  private scopeToStudent(exams: any[]): any[] {
    if (!this.studentProfileLoaded || !this.myClassId) return exams;
    return exams.filter((e: any) => {
      if (e?.classId && e.classId !== this.myClassId) return false;
      if (e?.sectionId && this.mySectionId && e.sectionId !== this.mySectionId) return false;
      return true;
    });
  }

  /** Recompute year-scoped option lists when student profile arrives after exams. */
  private recomputeYearScopedOptions(): void {
    const exList = Object.values(this.examsMap || {});
    const scopedExams = this.scopeToStudent(exList);
    const types = new Set<string>();
    scopedExams.forEach((e: any) => { if (e?.examType) types.add(e.examType); });
    this.examTypeOptions = Array.from(types).sort();
    const ids = new Set<string>();
    scopedExams.forEach((e: any) => { if (e?.subjectId) ids.add(e.subjectId); });
    this.subjectOptions = this.subjectOptions.filter((s) => ids.has(s.subjectId));
    this.applyFilter();
  }

  private buildMarkRows(rawMarks: any[]): MarkRow[] {
    return rawMarks
      .map((m: any) => {
        const exam = this.examsMap[m.examId];
        if (!exam) return null; // exam outside the chosen year (or deleted) → drop
        const maxMarks = exam.maxMarks || 100;
        const pct = maxMarks > 0 ? (m.marksObtained / maxMarks) * 100 : 0;
        const subjectId = exam.subjectId || '-';
        const subjectName = this.subjectNameFor(subjectId);
        return {
          examName: exam.name || 'Unknown Exam',
          examType: exam.examType || '',
          subjectId,
          subjectName,
          examDate: exam.examDate || '',
          marksObtained: m.marksObtained,
          maxMarks,
          percentage: Math.round(pct * 10) / 10,
          grade: m.grade || '-',
          passed: m.passed ?? m.isPassed ?? false,
        } as MarkRow;
      })
      .filter((r): r is MarkRow => r !== null);
  }

  private subjectNameFor(subjectId: string): string {
    const hit = this.subjectOptions.find((s) => s.subjectId === subjectId);
    if (hit) return hit.name;
    // Fallback to the cached name from SubjectService if available
    return this.subjectService.getSubjectName(subjectId);
  }

  /** Apply subject + exam-type filters to `allMarks` → `marks`, then recompute summary. */
  private applyFilter(): void {
    let view = this.allMarks;
    if (this.selectedSubjectIds.length > 0) {
      const allowed = new Set(this.selectedSubjectIds);
      view = view.filter((m) => allowed.has(m.subjectId));
    }
    if (this.selectedExamType) {
      view = view.filter((m) => m.examType === this.selectedExamType);
    }
    this.marks = view;
    this.computeSummary();
  }

  private computeSummary(): void {
    if (this.marks.length === 0) {
      this.totalExams = 0;
      this.averagePercentage = 0;
      this.bestSubject = '-';
      this.overallGrade = '-';
      return;
    }

    const examNames = new Set(this.marks.map((m) => m.examName));
    this.totalExams = examNames.size;

    const totalPct = this.marks.reduce((sum, m) => sum + m.percentage, 0);
    this.averagePercentage = Math.round((totalPct / this.marks.length) * 10) / 10;

    // Best subject by average percentage (use subjectName for display)
    const subjectStats: Record<string, { total: number; count: number; name: string }> = {};
    this.marks.forEach((m) => {
      if (!subjectStats[m.subjectId]) subjectStats[m.subjectId] = { total: 0, count: 0, name: m.subjectName || m.subjectId };
      subjectStats[m.subjectId].total += m.percentage;
      subjectStats[m.subjectId].count++;
    });
    let bestAvg = -1;
    this.bestSubject = '-';
    Object.values(subjectStats).forEach((s) => {
      const avg = s.total / s.count;
      if (avg > bestAvg) { bestAvg = avg; this.bestSubject = s.name; }
    });

    this.overallGrade = this.computeGrade(this.averagePercentage);
  }

  private computeGrade(pct: number): string {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }

  getGradeClass(grade: string): string {
    if (grade === 'A+' || grade === 'A') return 'grade-green';
    if (grade === 'B+' || grade === 'B') return 'grade-blue';
    if (grade === 'C' || grade === 'D') return 'grade-orange';
    return 'grade-red';
  }

  /** True when the year has at least one exam — controls the empty-state copy. */
  get yearHasExams(): boolean {
    return this.subjectOptions.length > 0 || this.allMarks.length > 0;
  }
}
