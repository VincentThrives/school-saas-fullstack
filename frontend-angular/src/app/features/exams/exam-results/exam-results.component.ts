import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { GradingService } from '../../../core/services/grading.service';
import { SubjectService } from '../../../core/services/subject.service';
import { forkJoin } from 'rxjs';

interface MarkEntry {
  studentId: string;
  marksObtained: number;
  grade?: string;
  remarks?: string;
  /** Backend's authoritative pass flag — computed from Subject.passRule
   *  (PER_COMPONENT or COMBINED) + nested sub-parts. Prefer this over any
   *  client-side scalar comparison for combined-mode exams. */
  isPassed?: boolean;
  /** "ABSENT" when the teacher marked the student absent in Enter Marks;
   *  "PRESENT" (or null for legacy rows) otherwise. Drives the Absent chip
   *  and keeps absent students out of the pass/fail/average rollups. */
  status?: string;
  /** Per-component / per-sub-part marks map. Keys are component.key or
   *  "<component.key>__<subComponent.key>" for sub-parts (same convention
   *  the Enter Marks page uses on save). Lets the Detailed Marks table
   *  break the row open with one cell per piece. */
  componentMarks?: Record<string, number>;
}

@Component({
  selector: 'app-exam-results',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './exam-results.component.html',
  styleUrl: './exam-results.component.scss',
})
export class ExamResultsComponent implements OnInit {
  examId = '';
  exam: any = null;
  marks: MarkEntry[] = [];
  studentMap: Record<string, { firstName: string; lastName: string; rollNumber?: string }> = {};
  classMap: Record<string, string> = {};
  isLoading = false;

  // Computed stats
  //   totalStudents  — full enrolled roster for the exam's class/section/subject
  //   enteredCount   — rows with real marks (status != ABSENT)
  //   notEnteredCount — enrolled minus every row the teacher has touched
  //   absentCount    — rows the teacher flagged ABSENT in Enter Marks
  //   passedCount / failedCount computed over the ENTERED set only, so an
  //   absent or not-yet-entered student isn't silently counted as a failure.
  //   passPercentage = passed / entered (not / total) for the same reason.
  totalStudents = 0;
  enteredCount = 0;
  notEnteredCount = 0;
  absentCount = 0;
  passedCount = 0;
  failedCount = 0;
  passPercentage = 0;
  classAverage = 0;
  gradeDistribution: { grade: string; count: number; color: string }[] = [];
  toppers: { studentId: string; name: string; marks: number; rank: number }[] = [];
  rankedMarks: {
    rank: number;
    studentId: string;
    name: string;
    marks: number;
    grade: string;
    passed: boolean;
    /** True when the teacher flagged the row Absent — the row still shows
     *  up (so Admin can see who missed) but marks/grade read as "-" and
     *  the Status column prints an "Absent" chip instead of Pass/Fail. */
    absent: boolean;
    remarks: string;
    /** Per-piece marks map (component.key → value, or
     *  "comp.key__sub.key" → value for sub-parts). */
    componentMarks: Record<string, number>;
  }[] = [];

  displayedColumns = ['rank', 'name', 'marks', 'grade', 'status', 'remarks'];

  /** Flat list of every input piece for this exam — one entry per bare
   *  component, one per sub-part when a component is split. Drives the
   *  per-piece columns in the Detailed Marks table + the mobile summary. */
  get resultInputs(): { key: string; label: string; maxMarks: number }[] {
    const out: { key: string; label: string; maxMarks: number }[] = [];
    const comps = (this.exam?.components || []) as any[];
    for (const c of comps) {
      const subs = Array.isArray(c.subComponents) ? c.subComponents : [];
      if (subs.length > 0) {
        for (const sc of subs) {
          out.push({
            key: `${c.key}__${sc.key}`,
            label: `${c.label} / ${sc.label}`,
            maxMarks: Number(sc.maxMarks) || 0,
          });
        }
      } else {
        out.push({
          key: c.key,
          label: c.label,
          maxMarks: Number(c.maxMarks) || 0,
        });
      }
    }
    return out;
  }

  /** Fetch one piece's mark for a given student row. */
  getPieceMark(row: { componentMarks: Record<string, number> }, key: string): string {
    const v = row.componentMarks?.[key];
    return (v === null || v === undefined) ? '-' : String(v);
  }

  /**
   * Effective MAX for a result row. For combined-mode exams (Math with
   * Theory 80 + IA 20, etc.) the legacy {@code exam.maxMarks} stores
   * only the FIRST component's max — using it as the denominator gave
   * "85 / 80" instead of "85 / 100" and cascaded to broken grades,
   * pass/fail, and percentages over 100. Sum across components when
   * the array is populated; fall back to the scalar field otherwise.
   */
  get effectiveMax(): number {
    const comps = (this.exam?.components || []) as { maxMarks?: number }[];
    if (comps.length > 0) {
      return comps.reduce((sum, c) => sum + (Number(c?.maxMarks) || 0), 0);
    }
    return Number(this.exam?.maxMarks) || 100;
  }

  /** Effective PASS threshold — sum of per-component passing marks for
   *  combined exams, else the scalar field. Same reasoning as
   *  {@link effectiveMax}. */
  get effectivePass(): number {
    const comps = (this.exam?.components || []) as { passingMarks?: number }[];
    if (comps.length > 0) {
      return comps.reduce((sum, c) => sum + (Number(c?.passingMarks) || 0), 0);
    }
    return Number(this.exam?.passingMarks) || 35;
  }

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private route: ActivatedRoute,
    private router: Router,
    /** Shared grading helper — applies the editable scale from
     *  Settings → Academic + standard rounding. */
    private grading: GradingService,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId') || '';
    // Load the school's grading scale BEFORE loadResults so that the
    // grade-distribution chart and ranked table use the configured
    // bands. If settings haven't been saved yet the service falls back
    // to its sensible defaults.
    this.grading.load().subscribe(() => {
      this.loadResults();
    });
    this.loadClasses();
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
    if (this.exam?.className) return this.exam.className;
    if (this.exam?.classId) return this.classMap[this.exam.classId] || this.exam.classId;
    return '-';
  }

  getSubjectName(): string {
    if (this.exam?.subjectName) return this.exam.subjectName;
    if (this.exam?.subjectId) return this.subjectService.getSubjectName(this.exam.subjectId);
    return '-';
  }

  loadResults(): void {
    this.isLoading = true;

    // Pull the exam first so we know its class/section/subject — then the
    // roster fetch below can scope to EXACTLY the students eligible to sit
    // the exam. That same scoped list is what powers the "enrolled total"
    // KPI, so the Not-Entered count is apples-to-apples with Enter Marks.
    this.api.getExamById(this.examId).subscribe({
      next: (exam) => {
        if (exam.success && exam.data) {
          this.exam = exam.data;
        }

        const rosterParams: any = {};
        if (this.exam?.classId) rosterParams.classId = this.exam.classId;
        if (this.exam?.sectionId) rosterParams.sectionId = this.exam.sectionId;
        if (this.exam?.subjectId) rosterParams.subjectId = this.exam.subjectId;

        forkJoin({
          results: this.api.getExamResults(this.examId),
          students: this.api.getStudents(
            0,
            5000,
            Object.keys(rosterParams).length > 0 ? rosterParams : undefined,
          ),
        }).subscribe({
          next: ({ results, students }) => {
            // Build student map (also doubles as our enrolled roster — the
            // request above is scoped to the exam, so size == enrolled).
            let studentList = students.data?.content || [];
            // Defence in depth: if the backend doesn't support the subject/
            // section filter yet, trim client-side so the KPI doesn't
            // over-count a sibling section's roster.
            if (this.exam?.sectionId) {
              studentList = studentList.filter((s: any) => s?.sectionId === this.exam.sectionId);
            }
            if (this.exam?.classId) {
              studentList = studentList.filter((s: any) => s?.classId === this.exam.classId);
            }
            studentList.forEach((s: any) => {
              this.studentMap[s.studentId] = {
                firstName: s.firstName || '',
                lastName: s.lastName || '',
                rollNumber: s.rollNumber,
              };
            });
            const enrolled = studentList.length;

            // Process results — API returns allMarks (incl. status), toppers, etc.
            const data = results.data;
            if (data) {
              this.marks = data.allMarks || [];
              // Split rows up front: absent entries don't contribute to
              // pass/fail/average and shouldn't skew the grade distribution,
              // but they still count toward "the teacher touched this row"
              // so Not-Entered reflects only students with NO record.
              const presentMarks = this.marks.filter((m: any) => m.status !== 'ABSENT');
              const absentMarks = this.marks.filter((m: any) => m.status === 'ABSENT');
              this.totalStudents = enrolled > 0 ? enrolled : this.marks.length;
              this.enteredCount = presentMarks.length;
              this.absentCount = absentMarks.length;
              this.notEnteredCount = Math.max(0, this.totalStudents - this.marks.length);

              // Trust the backend isPassed flag — it already applies the subject's
              // PassRule (PER_COMPONENT or COMBINED) and handles sub-parts. Fall
              // back to total>=pass only when the field is absent (legacy data).
              const cPass = this.effectivePass;
              this.passedCount = presentMarks.filter((m: any) =>
                m.isPassed != null ? !!m.isPassed : m.marksObtained >= cPass
              ).length;
              this.failedCount = this.enteredCount - this.passedCount;
              // Pass % is over students who actually sat the exam — mixing
              // absents or not-entered rows in would read as "fail" and
              // under-report the real pass rate.
              this.passPercentage = this.enteredCount > 0
                ? Math.round((this.passedCount / this.enteredCount) * 100)
                : 0;
              const totalScored = presentMarks.reduce((s: number, m: any) => s + (m.marksObtained || 0), 0);
              this.classAverage = this.enteredCount > 0
                ? Math.round((totalScored / this.enteredCount) * 10) / 10
                : 0;

              // Grade distribution — recompute locally from GradingService.
              // Absents are skipped so they don't inflate the F bucket.
              {
                const cMax = this.effectiveMax;
                const gradeMap: Record<string, number> = {};
                for (const m of presentMarks) {
                  const g = this.grading.gradeFor(m.marksObtained, cMax, cPass);
                  gradeMap[g] = (gradeMap[g] || 0) + 1;
                }
                const order = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'];
                const gradeColors: Record<string, string> = {
                  'A+': '#4caf50', A: '#66bb6a', 'B+': '#42a5f5', B: '#64b5f6',
                  C: '#ffa726', D: '#ff7043', F: '#ef5350',
                };
                this.gradeDistribution = order
                  .filter(g => gradeMap[g])
                  .map(g => ({
                    grade: g,
                    count: gradeMap[g],
                    color: gradeColors[g] || '#9e9e9e',
                  }));
                for (const g of Object.keys(gradeMap)) {
                  if (!order.includes(g)) {
                    this.gradeDistribution.push({
                      grade: g,
                      count: gradeMap[g],
                      color: gradeColors[g] || '#9e9e9e',
                    });
                  }
                }
              }

              // Toppers — strip anyone the backend might have included as
              // absent so the leaderboard doesn't read "AB 0 / 50 — #1".
              this.toppers = (data.toppers || [])
                .filter((t: any) => t.status !== 'ABSENT')
                .map((t: any, i: number) => ({
                  studentId: t.studentId,
                  name: this.getStudentName(t.studentId),
                  marks: t.marksObtained,
                  rank: i + 1,
                }));

              // Full ranked list — rank present students first (desc by
              // marks), then append absents at the bottom with a dash rank
              // so Admin still sees who missed the exam. Grade/pass render
              // from backend flags or recompute from thresholds, same as
              // before, but respect the Absent status.
              const maxMarks = this.effectiveMax;
              const passingMarks = this.effectivePass;
              const sortedPresent = [...presentMarks].sort((a: any, b: any) => b.marksObtained - a.marksObtained);
              const presentRows = sortedPresent.map((m: any, i: number) => {
                const passed = m.isPassed != null ? !!m.isPassed : (m.marksObtained >= passingMarks);
                return {
                  rank: i + 1,
                  studentId: m.studentId,
                  name: this.getStudentName(m.studentId),
                  marks: m.marksObtained,
                  grade: this.getGrade(m.marksObtained, maxMarks, passingMarks),
                  passed,
                  absent: false,
                  remarks: m.remarks || '',
                  componentMarks: m.componentMarks || {},
                };
              });
              const absentRows = absentMarks
                .sort((a: any, b: any) => this.getStudentName(a.studentId)
                  .localeCompare(this.getStudentName(b.studentId)))
                .map((m: any) => ({
                  rank: 0,
                  studentId: m.studentId,
                  name: this.getStudentName(m.studentId),
                  marks: 0,
                  grade: 'AB',
                  passed: false,
                  absent: true,
                  remarks: m.remarks || '',
                  componentMarks: m.componentMarks || {},
                }));
              this.rankedMarks = [...presentRows, ...absentRows];
              const pieces = this.resultInputs;
              const pieceCols = pieces.map(p => 'piece_' + p.key);
              this.displayedColumns = pieces.length > 0
                ? ['rank', 'name', ...pieceCols, 'marks', 'grade', 'status', 'remarks']
                : ['rank', 'name', 'marks', 'grade', 'status', 'remarks'];
            }

            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
          },
        });
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private computeStats(): void {
    const maxMarks = this.effectiveMax;
    const passingMarks = this.effectivePass;

    this.totalStudents = this.marks.length;
    this.passedCount = this.marks.filter((m: any) =>
      m.isPassed != null ? !!m.isPassed : m.marksObtained >= passingMarks
    ).length;
    this.failedCount = this.totalStudents - this.passedCount;
    this.passPercentage = this.totalStudents > 0 ? Math.round((this.passedCount / this.totalStudents) * 100) : 0;

    const totalMarks = this.marks.reduce((sum, m) => sum + (m.marksObtained || 0), 0);
    this.classAverage = this.totalStudents > 0 ? Math.round((totalMarks / this.totalStudents) * 10) / 10 : 0;

    // Grade distribution
    const gradeMap: Record<string, number> = {};
    const sortedMarks = [...this.marks].sort((a, b) => b.marksObtained - a.marksObtained);

    sortedMarks.forEach((m) => {
      const grade = this.getGrade(m.marksObtained, maxMarks, passingMarks);
      gradeMap[grade] = (gradeMap[grade] || 0) + 1;
    });

    const gradeColors: Record<string, string> = {
      'A+': '#4caf50', A: '#66bb6a', 'B+': '#42a5f5', B: '#64b5f6',
      C: '#ffa726', D: '#ff7043', F: '#ef5350',
    };
    this.gradeDistribution = Object.entries(gradeMap).map(([grade, count]) => ({
      grade,
      count,
      color: gradeColors[grade] || '#9e9e9e',
    }));

    // Toppers (top 5)
    this.toppers = sortedMarks.slice(0, 5).map((m, i) => ({
      studentId: m.studentId,
      name: this.getStudentName(m.studentId),
      marks: m.marksObtained,
      rank: i + 1,
    }));

    // Full ranked list
    this.rankedMarks = sortedMarks.map((m: any, i) => ({
      rank: i + 1,
      studentId: m.studentId,
      name: this.getStudentName(m.studentId),
      marks: m.marksObtained,
      grade: this.getGrade(m.marksObtained, maxMarks, passingMarks),
      passed: m.isPassed != null ? !!m.isPassed : (m.marksObtained >= passingMarks),
      absent: (m as any).status === 'ABSENT',
      remarks: m.remarks || '',
      componentMarks: m.componentMarks || {},
    }));
    const pieces = this.resultInputs;
    const pieceCols = pieces.map(p => 'piece_' + p.key);
    this.displayedColumns = pieces.length > 0
      ? ['rank', 'name', ...pieceCols, 'marks', 'grade', 'status', 'remarks']
      : ['rank', 'name', 'marks', 'grade', 'status', 'remarks'];
  }

  getStudentName(studentId: string): string {
    const s = this.studentMap[studentId];
    if (s) {
      const name = `${s.firstName} ${s.lastName}`.trim();
      if (name) return name;
    }
    // Roster lookup missed — show a friendlier placeholder than the
    // raw UUID. Happens when a student's record is older than the
    // current roster page or the lookup endpoint timed out.
    return 'Student record missing';
  }

  /** Letter grade for a marks value. Delegates to {@link GradingService}
   *  so the bands match whatever the admin saved on Settings → Academic
   *  and standard rounding is applied (89.5 → 90, 89.4 → 89). F stays
   *  anchored to the exam's own pass threshold inside the service. */
  getGrade(marks: number, maxMarks: number, passingMarks: number = 35): string {
    return this.grading.gradeFor(marks, maxMarks, passingMarks);
  }

  getMedalIcon(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }

  getGradeBarWidth(count: number): string {
    const max = Math.max(...this.gradeDistribution.map((g) => g.count), 1);
    return `${(count / max) * 100}%`;
  }

  goBack(): void {
    this.router.navigate(['/exams']);
  }
}
