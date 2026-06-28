import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { GridNavDirective } from '../../../shared/directives/grid-nav.directive';
import { ApiService } from '../../../core/services/api.service';
import { GradingService } from '../../../core/services/grading.service';
import { SubjectService } from '../../../core/services/subject.service';

interface StudentMark {
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  /**
   * Per-component-mode entry: a single obtained marks value against the
   * exam's own max/pass.
   */
  marksObtained: number | null;
  /**
   * Combined-mode entry: per-component obtained marks keyed by component
   * key. Empty {} when the exam isn't combined-mode.
   */
  componentMarks: Record<string, number | null>;
  remarks: string;
}

/** Component slice rendered as its own column when the exam is combined-mode. */
interface ExamComponentDef {
  key: string;
  label: string;
  maxMarks: number;
  passingMarks: number;
}

@Component({
  selector: 'app-enter-marks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
    GridNavDirective,
  ],
  templateUrl: './enter-marks.component.html',
  styleUrl: './enter-marks.component.scss',
})
export class EnterMarksComponent implements OnInit {
  examId: string = '';
  exam: any = null;
  students: StudentMark[] = [];
  displayedColumns: string[] = [];
  isLoading = false;
  isSaving = false;
  classMap: Record<string, string> = {};

  /** Component columns for combined-mode exams. Empty for per-component. */
  examComponents: ExamComponentDef[] = [];

  /** True when this exam is a combined-mode exam (one doc carrying multiple components). */
  get isCombined(): boolean {
    return this.examComponents.length > 0;
  }


  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private snackBar: MatSnackBar,
    /** Shared grading helper — pulls the school's editable scale from
     *  Settings → Academic and applies standard rounding. */
    public grading: GradingService,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId') || '';
    // Kick off the grading-scale load so the pill in this page reflects
    // the school's bands instead of any hardcoded defaults. The service
    // caches across the session so this is a no-op when other pages
    // already triggered it.
    this.grading.load().subscribe();
    this.loadClasses();
    this.loadExamAndStudents();
  }

  loadClasses(): void {
    this.api.getClasses().subscribe({
      next: (res) => {
        const classes = Array.isArray(res.data) ? res.data : [];
        classes.forEach((c: any) => { this.classMap[c.classId] = c.name; });
      },
    });
  }

  getClassName(): string {
    let name = this.exam?.className || (this.exam?.classId ? this.classMap[this.exam.classId] : null) || '-';
    const section = this.exam?.sectionName;
    if (section) name += ' - ' + section;
    return name;
  }

  getSubjectName(): string {
    if (this.exam?.subjectName) return this.exam.subjectName;
    if (this.exam?.subjectId) return this.subjectService.getSubjectName(this.exam.subjectId);
    return '-';
  }

  loadExamAndStudents(): void {
    this.isLoading = true;
    // Load exam details by ID
    this.api.getExamById(this.examId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.exam = res.data;
          this.examComponents = this.resolveExamComponents(res.data);
          this.displayedColumns = this.buildDisplayedColumns();
        }
        this.loadStudents();
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam', 'Close', { duration: 3000 });
      },
    });
  }

  /**
   * Extract the component column definitions for a combined-mode exam.
   * Returns [] for per-component exams (single column path, legacy shape).
   */
  private resolveExamComponents(exam: any): ExamComponentDef[] {
    const comps = exam?.components;
    if (!Array.isArray(comps) || comps.length === 0) return [];
    return comps.map((c: any) => ({
      key: c.key,
      label: c.label || c.key,
      maxMarks: Number(c.maxMarks) || 0,
      passingMarks: Number(c.passingMarks) || 0,
    }));
  }

  /** Column set for the marks table — adapts to combined vs per-component. */
  private buildDisplayedColumns(): string[] {
    if (this.examComponents.length > 0) {
      // Combined: one column per component instead of a single marksObtained.
      const cols = ['rollNumber', 'name'];
      for (const c of this.examComponents) cols.push('comp_' + c.key);
      cols.push('total', 'status', 'remarks');
      return cols;
    }
    return ['rollNumber', 'name', 'marksObtained', 'status', 'remarks'];
  }

  private loadStudents(): void {
    if (!this.exam) {
      this.isLoading = false;
      return;
    }

    // Strictly scope to this exam's class + section. A zero-result here means
    // there genuinely are no students in 2-A (or whatever the exam targets),
    // NOT that we should show every student in the school — the old fallback
    // did that and dragged a 1-A student onto every class/section's mark
    // entry screen.
    const params: any = {};
    if (this.exam.classId) params.classId = this.exam.classId;
    if (this.exam.sectionId) params.sectionId = this.exam.sectionId;
    // Pass the exam's subjectId so the backend trims the roster to
    // enrolled students when the subject is marked elective (e.g.
    // PU Kannada chosen by only 30 of 50 in the section). For
    // non-electives the param is a no-op.
    if (this.exam.subjectId) params.subjectId = this.exam.subjectId;
    this.api.getStudents(0, 100, Object.keys(params).length > 0 ? params : undefined).subscribe({
      next: (res) => {
        let studentList = res.data?.content || [];
        // Defence in depth: even when the backend supports sectionId, older
        // builds may return the whole class when the filter is unknown. Apply
        // an explicit client-side filter so an over-broad response can't slip
        // someone else's student onto this exam's roster.
        if (this.exam?.sectionId) {
          studentList = studentList.filter((s: any) =>
            s?.sectionId === this.exam.sectionId);
        }
        if (this.exam?.classId) {
          studentList = studentList.filter((s: any) =>
            s?.classId === this.exam.classId);
        }
        this.mapStudents(studentList);
        this.loadExistingMarks();
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private mapStudents(studentList: any[]): void {
    // Sort alphabetically by full name so the marks-entry grid reads
    // top-to-bottom in the same order teachers expect from the
    // attendance + admit-card flows. Backend returns whatever Mongo
    // hands back (usually creation order), which doesn't match the
    // teacher's mental model.
    this.students = studentList
      .map((s: any) => ({
        studentId: s.studentId,
        rollNumber: s.rollNumber || '',
        firstName: s.firstName || `Student ${s.admissionNumber || ''}`,
        lastName: s.lastName || '',
        marksObtained: null,
        componentMarks: this.emptyComponentMarks(),
        remarks: '',
      }))
      .sort((a, b) => {
        const an = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
        const bn = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
        return an.localeCompare(bn);
      });
  }

  private emptyComponentMarks(): Record<string, number | null> {
    const out: Record<string, number | null> = {};
    for (const c of this.examComponents) out[c.key] = null;
    return out;
  }

  /**
   * Fetch previously saved marks for this exam and merge them into the student rows
   * so the teacher sees the existing values and can edit individual entries instead
   * of re-entering everyone's marks.
   */
  private loadExistingMarks(): void {
    if (!this.examId || this.students.length === 0) {
      this.isLoading = false;
      return;
    }
    this.api.getExamMarks(this.examId).subscribe({
      next: (res) => {
        const entries = res?.data || [];
        if (entries.length > 0) {
          const byStudent: Record<string, any> = {};
          entries.forEach((e: any) => {
            if (e?.studentId) byStudent[e.studentId] = e;
          });
          this.students = this.students.map((s) => {
            const existing = byStudent[s.studentId];
            if (!existing) return s;
            const raw = existing.marksObtained;
            // For combined-mode exams, also pre-load any saved per-component
            // values so the teacher sees the existing entries when they reopen.
            const compMarks = this.emptyComponentMarks();
            if (this.isCombined && existing.componentMarks && typeof existing.componentMarks === 'object') {
              for (const c of this.examComponents) {
                const v = existing.componentMarks[c.key];
                compMarks[c.key] = (v === null || v === undefined || v === '') ? null : Number(v);
              }
            }
            return {
              ...s,
              marksObtained: raw === null || raw === undefined || raw === '' ? null : Number(raw),
              componentMarks: compMarks,
              remarks: existing.remarks || s.remarks || '',
            };
          });
        }
        this.isLoading = false;
      },
      error: () => {
        // Not fatal — teacher can still enter marks fresh
        this.isLoading = false;
      },
    });
  }

  get maxMarks(): number {
    if (this.isCombined) {
      return this.examComponents.reduce((s, c) => s + (c.maxMarks || 0), 0);
    }
    return this.exam?.maxMarks || 100;
  }

  get passingMarks(): number {
    if (this.isCombined) {
      return this.examComponents.reduce((s, c) => s + (c.passingMarks || 0), 0);
    }
    return this.exam?.passingMarks || 35;
  }

  isPassing(marks: number | null): boolean {
    return marks !== null && marks >= this.passingMarks;
  }

  /** Sum of obtained marks across components — used as the displayed total. */
  totalFor(student: StudentMark): number {
    if (!this.isCombined) return Number(student.marksObtained) || 0;
    let sum = 0;
    for (const c of this.examComponents) {
      const v = student.componentMarks[c.key];
      if (v !== null && v !== undefined) sum += Number(v);
    }
    return sum;
  }

  /** Pass/fail across combined components — every component must clear its own
   *  pass cap (the PER_COMPONENT default; report card aggregator does the
   *  authoritative subject-level call). */
  isCombinedPassing(student: StudentMark): boolean {
    for (const c of this.examComponents) {
      const v = student.componentMarks[c.key];
      if (v === null || v === undefined) return false;
      if (Number(v) < (c.passingMarks || 0)) return false;
    }
    return this.examComponents.length > 0;
  }

  /** True when any component has a marks entry — drives the pass/fail chip
   *  visibility in combined mode (only show after teacher starts typing). */
  hasAnyCombinedEntry(student: StudentMark): boolean {
    return this.examComponents.some(c => {
      const v = student.componentMarks[c.key];
      return v !== null && v !== undefined;
    });
  }

  /** Letter grade for the displayed pill on this page. Delegates to
   *  {@link GradingService} so the bands match whatever the admin
   *  configured on Settings → Academic, and standard rounding is
   *  applied (89.5 → 90, 89.4 → 89). F is anchored to the school's
   *  per-exam pass threshold so e.g. an exam with passingMarks=17/50
   *  reads 17 as "Pass (D)" rather than "Pass (F)". */
  getGrade(marks: number | null): string {
    return this.grading.gradeFor(marks, this.maxMarks, this.passingMarks);
  }

  /**
   * Handle typing/spinner in the marks field. We can't rely on the input
   * element's [max] attribute — browsers don't enforce it for typed
   * values, only for the spinner. So we clamp here:
   *   • Empty → null (no marks entered yet).
   *   • Below 0 → 0.
   *   • Above maxMarks → capped at maxMarks + a one-shot toast so the
   *     teacher knows why their "75" became "70".
   * The clamped value is pushed back into the input element directly,
   * since we use one-way [value] binding (two-way would re-trigger this
   * handler in a loop).
   */
  onMarksChange(student: StudentMark, value: string, event?: Event): void {
    if (value === '' || value == null) {
      student.marksObtained = null;
      return;
    }
    let numVal = parseInt(value, 10);
    if (isNaN(numVal)) {
      student.marksObtained = null;
      return;
    }
    if (numVal < 0) numVal = 0;
    if (numVal > this.maxMarks) {
      numVal = this.maxMarks;
      this.snackBar.open(
        `Marks can't exceed the exam max (${this.maxMarks}). Capped.`,
        'Close', { duration: 2500 });
      const target = event?.target as HTMLInputElement | undefined;
      if (target) target.value = String(numVal);
    }
    student.marksObtained = numVal;
  }

  /** Clamp + validate per-component cell input on combined-mode exams. */
  onComponentMarksChange(student: StudentMark, comp: ExamComponentDef, value: string, event?: Event): void {
    if (value === '' || value == null) {
      student.componentMarks[comp.key] = null;
      return;
    }
    let numVal = parseInt(value, 10);
    if (isNaN(numVal)) {
      student.componentMarks[comp.key] = null;
      return;
    }
    if (numVal < 0) numVal = 0;
    if (numVal > comp.maxMarks) {
      numVal = comp.maxMarks;
      this.snackBar.open(
        `${comp.label} max is ${comp.maxMarks}. Capped.`,
        'Close', { duration: 2500 });
      const target = event?.target as HTMLInputElement | undefined;
      if (target) target.value = String(numVal);
    }
    student.componentMarks[comp.key] = numVal;
  }

  saveMarks(): void {
    let validMarks: any[];
    if (this.isCombined) {
      // Combined mode: send componentMarks map per student. Include a student
      // if AT LEAST ONE component has a value — partial entries are allowed
      // so a teacher can save mid-exam and finish later.
      validMarks = this.students
        .filter((s) => this.hasAnyCombinedEntry(s))
        .map((s) => {
          // Strip null/empty cells before sending so the backend doesn't
          // misread "0" intent vs "not entered".
          const map: Record<string, number> = {};
          for (const c of this.examComponents) {
            const v = s.componentMarks[c.key];
            if (v !== null && v !== undefined) map[c.key] = Number(v);
          }
          return {
            studentId: s.studentId,
            subjectId: this.exam?.subjectId || '',
            componentMarks: map,
            remarks: s.remarks || '',
          };
        });
    } else {
      validMarks = this.students
        .filter((s) => s.marksObtained !== null)
        .map((s) => ({
          studentId: s.studentId,
          subjectId: this.exam?.subjectId || '',
          marksObtained: s.marksObtained as number,
          remarks: s.remarks || '',
        }));
    }

    if (validMarks.length === 0) {
      this.snackBar.open('No marks to save', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    this.api.enterMarks({ examId: this.examId, marks: validMarks }).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Marks saved successfully', 'Close', { duration: 3000 });
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Failed to save marks', 'Close', { duration: 3000 });
      },
    });
  }

  goBack(): void {
    // Location.back() walks the browser history so the previous URL —
    // including any ?ay=&classId=&sectionId= filters the admin had
    // applied on the exams list — restores intact. router.navigate
    // would drop those query params and reset every dropdown to its
    // default, forcing the admin to re-filter to find the next exam.
    //
    // Fallback to /exams when history is empty (deep-linked tab) so
    // the button is never a dead end.
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/exams']);
    }
  }
}
