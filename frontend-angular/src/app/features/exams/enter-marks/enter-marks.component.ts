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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
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
  /** Teacher toggled this student as absent — inputs disabled, status chip
   *  shows AB, save payload carries absent=true and the backend writes an
   *  ABSENT MarkEntry. Admin can later clear the toggle and type real marks
   *  (e.g. after a makeup exam). */
  absent: boolean;
}

/** Component slice rendered as its own column when the exam is combined-mode.
 *  When {@link subComponents} is populated the component itself isn't an input
 *  column — one input column per sub-part is rendered and the component total
 *  becomes an auto-sum read-only column. */
interface ExamComponentDef {
  key: string;
  label: string;
  maxMarks: number;
  passingMarks: number;
  subComponents?: ExamSubComponentDef[];
}

/** One sub-part under a component. Mark entry stores its value under the
 *  dotted key "<component.key>.<subComponent.key>" on componentMarks. */
interface ExamSubComponentDef {
  key: string;
  label: string;
  maxMarks: number;
  passingMarks: number;
  /** Pre-computed "theory.paper1" string so the template doesn't construct it. */
  fullKey: string;
  parentKey: string;
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
    MatCheckboxModule,
    MatSlideToggleModule,
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
    return comps.map((c: any) => {
      const subs = Array.isArray(c.subComponents) && c.subComponents.length > 0
        ? c.subComponents.map((sc: any) => ({
            key: sc.key,
            label: sc.label || sc.key,
            maxMarks: Number(sc.maxMarks) || 0,
            passingMarks: Number(sc.passingMarks) || 0,
            // Separator is "__" (not ".") — MongoDB rejects dotted map keys
            // on the StudentAssessments.componentMarks BSON map. Keep both
            // sides in lockstep with the backend (see ExamService.buildCombinedEntry).
            fullKey: `${c.key}__${sc.key}`,
            parentKey: c.key,
          }))
        : undefined;
      return {
        key: c.key,
        label: c.label || c.key,
        maxMarks: Number(c.maxMarks) || 0,
        passingMarks: Number(c.passingMarks) || 0,
        subComponents: subs,
      };
    });
  }

  /** Column set for the marks table — adapts to combined vs per-component.
   *  When a component has sub-parts: each sub-part gets its own input column
   *  AND the component itself gets a read-only auto-sum column. */
  private buildDisplayedColumns(): string[] {
    if (this.examComponents.length > 0) {
      const cols = ['rollNumber', 'name'];
      for (const c of this.examComponents) {
        if (c.subComponents?.length) {
          for (const sc of c.subComponents) cols.push('subcomp_' + sc.fullKey);
          cols.push('compsum_' + c.key);
        } else {
          cols.push('comp_' + c.key);
        }
      }
      cols.push('total', 'status', 'remarks');
      return cols;
    }
    return ['rollNumber', 'name', 'marksObtained', 'status', 'remarks'];
  }

  /** Flat list of every input column — components with sub-parts contribute
   *  one entry per sub-part; components without sub-parts contribute one
   *  entry for themselves. Used by the template to render input cells. */
  get flatInputDefs(): ExamSubComponentDef[] {
    const out: ExamSubComponentDef[] = [];
    for (const c of this.examComponents) {
      if (c.subComponents?.length) {
        for (const sc of c.subComponents) out.push(sc);
      } else {
        out.push({
          key: c.key, label: c.label,
          maxMarks: c.maxMarks, passingMarks: c.passingMarks,
          fullKey: c.key, parentKey: c.key,
        });
      }
    }
    return out;
  }

  /** Sum the obtained marks for a given component's sub-parts, used by the
   *  read-only "component total" column. */
  componentSumFor(student: StudentMark, comp: ExamComponentDef): number {
    if (!comp.subComponents?.length) {
      const v = student.componentMarks[comp.key];
      return v == null ? 0 : Number(v) || 0;
    }
    let sum = 0;
    for (const sc of comp.subComponents) {
      const v = student.componentMarks[sc.fullKey];
      if (v != null) sum += Number(v) || 0;
    }
    return sum;
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
        absent: false,
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
            // Components with sub-parts need the SUB-PART keys hydrated (not
            // the parent component key — that one holds the auto-sum which
            // componentSumFor rebuilds from the sub-parts).
            const compMarks = this.emptyComponentMarks();
            if (this.isCombined && existing.componentMarks && typeof existing.componentMarks === 'object') {
              for (const c of this.examComponents) {
                if (c.subComponents?.length) {
                  for (const sc of c.subComponents) {
                    const sv = existing.componentMarks[sc.fullKey];
                    compMarks[sc.fullKey] = (sv === null || sv === undefined || sv === '') ? null : Number(sv);
                  }
                } else {
                  const v = existing.componentMarks[c.key];
                  compMarks[c.key] = (v === null || v === undefined || v === '') ? null : Number(v);
                }
              }
            }
            return {
              ...s,
              marksObtained: raw === null || raw === undefined || raw === '' ? null : Number(raw),
              componentMarks: compMarks,
              remarks: existing.remarks || s.remarks || '',
              absent: existing.status === 'ABSENT',
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

  /** Grand max/pass for the Total column — comes from the exam doc, which was
   *  stamped at rollout from the scheme's slot.rawMax / slot.passingMarks.
   *  We deliberately do NOT sum the components here: the scheme lets the admin
   *  set a slot-level pass bar (e.g. 17/50) that may differ from the sum of
   *  component passes (e.g. 5+5+8 = 18). The slot-level value wins. */
  get maxMarks(): number {
    return this.exam?.maxMarks || 100;
  }

  get passingMarks(): number {
    return this.exam?.passingMarks || 35;
  }

  isPassing(marks: number | null): boolean {
    return marks !== null && marks >= this.passingMarks;
  }

  /** Sum of obtained marks across components — used as the displayed total.
   *  For a component with sub-parts, uses the sub-parts' sum (componentSumFor)
   *  rather than the stored component total so the UI stays live as the
   *  teacher types in sub-part cells. */
  totalFor(student: StudentMark): number {
    if (!this.isCombined) return Number(student.marksObtained) || 0;
    let sum = 0;
    for (const c of this.examComponents) {
      sum += this.componentSumFor(student, c);
    }
    return sum;
  }

  /** Pass/fail across combined components. Component is "cleared" when its
   *  effective total (sub-parts sum when split, direct value otherwise) meets
   *  the component's pass bar. Report card aggregator does the authoritative
   *  subject-level call using {@code Subject.passRule}; this is the UI flag. */
  isCombinedPassing(student: StudentMark): boolean {
    if (this.examComponents.length === 0) return false;
    for (const c of this.examComponents) {
      if (!this.hasComponentEntry(student, c)) return false;
      if (this.componentSumFor(student, c) < (c.passingMarks || 0)) return false;
    }
    return true;
  }

  /** True when at least one input cell for this component has a value — a
   *  sub-part counts for a split component, the component itself otherwise. */
  hasComponentEntry(student: StudentMark, c: ExamComponentDef): boolean {
    if (c.subComponents?.length) {
      return c.subComponents.some(sc => {
        const v = student.componentMarks[sc.fullKey];
        return v !== null && v !== undefined;
      });
    }
    const v = student.componentMarks[c.key];
    return v !== null && v !== undefined;
  }

  /** True when any component (or sub-part) has a marks entry — drives the
   *  pass/fail chip visibility in combined mode. */
  hasAnyCombinedEntry(student: StudentMark): boolean {
    return this.examComponents.some(c => this.hasComponentEntry(student, c));
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

  /** Toggle the Absent flag on a student. Turning ON clears every mark cell
   *  so the save payload stays consistent (ABSENT entries carry no marks).
   *  Turning OFF leaves the (empty) cells alone — teacher types fresh marks
   *  when a makeup is conducted. */
  toggleAbsent(student: StudentMark, next: boolean): void {
    student.absent = next;
    if (!next) return;
    student.marksObtained = null;
    for (const key of Object.keys(student.componentMarks)) {
      student.componentMarks[key] = null;
    }
  }

  /** Clamp + validate per-sub-part cell input. Stores under the dotted
   *  "<component.key>.<sub.key>" key so the backend can distinguish sub-part
   *  values from the aggregated component total. */
  onSubComponentMarksChange(student: StudentMark, sub: ExamSubComponentDef,
                            value: string, event?: Event): void {
    if (value === '' || value == null) {
      student.componentMarks[sub.fullKey] = null;
      return;
    }
    let numVal = parseInt(value, 10);
    if (isNaN(numVal)) {
      student.componentMarks[sub.fullKey] = null;
      return;
    }
    if (numVal < 0) numVal = 0;
    if (numVal > sub.maxMarks) {
      numVal = sub.maxMarks;
      this.snackBar.open(
        `${sub.label} max is ${sub.maxMarks}. Capped.`,
        'Close', { duration: 2500 });
      const target = event?.target as HTMLInputElement | undefined;
      if (target) target.value = String(numVal);
    }
    student.componentMarks[sub.fullKey] = numVal;
  }

  saveMarks(): void {
    let validMarks: any[];
    if (this.isCombined) {
      // Combined mode: send componentMarks map per student. Include a student
      // if AT LEAST ONE component has a value OR they're marked absent —
      // partial entries are allowed so a teacher can save mid-exam and
      // finish later, and absent entries must round-trip too.
      validMarks = this.students
        .filter((s) => s.absent || this.hasAnyCombinedEntry(s))
        .map((s) => {
          if (s.absent) {
            // Absent short-circuit — no marks, backend writes an ABSENT stub.
            return {
              studentId: s.studentId,
              subjectId: this.exam?.subjectId || '',
              componentMarks: {},
              remarks: s.remarks || '',
              absent: true,
            };
          }
          // Strip null/empty cells before sending so the backend doesn't
          // misread "0" intent vs "not entered".
          const map: Record<string, number> = {};
          // Send ONLY leaf cells: for a component with sub-parts, send each
          // sub-part's value; for a bare component, send the component value.
          // Backend aggregates and stores the component total alongside.
          for (const c of this.examComponents) {
            if (c.subComponents?.length) {
              for (const sc of c.subComponents) {
                const v = s.componentMarks[sc.fullKey];
                if (v !== null && v !== undefined) map[sc.fullKey] = Number(v);
              }
            } else {
              const v = s.componentMarks[c.key];
              if (v !== null && v !== undefined) map[c.key] = Number(v);
            }
          }
          return {
            studentId: s.studentId,
            subjectId: this.exam?.subjectId || '',
            componentMarks: map,
            remarks: s.remarks || '',
            absent: false,
          };
        });
    } else {
      validMarks = this.students
        .filter((s) => s.absent || s.marksObtained !== null)
        .map((s) => (s.absent
          ? {
              studentId: s.studentId,
              subjectId: this.exam?.subjectId || '',
              marksObtained: 0,
              remarks: s.remarks || '',
              absent: true,
            }
          : {
              studentId: s.studentId,
              subjectId: this.exam?.subjectId || '',
              marksObtained: s.marksObtained as number,
              remarks: s.remarks || '',
              absent: false,
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
