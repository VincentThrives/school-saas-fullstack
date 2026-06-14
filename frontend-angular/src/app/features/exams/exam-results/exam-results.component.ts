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
  totalStudents = 0;
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
    remarks: string;
  }[] = [];

  displayedColumns = ['rank', 'name', 'marks', 'grade', 'status', 'remarks'];

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

    // Fetch the full student roster up to 5000 so the name lookup map
    // covers schools with hundreds of students. The previous 200 cap
    // meant the last students in the list rendered as their UUID instead
    // of "Firstname Lastname". Proper fix is a batch-by-id endpoint but
    // this is enough for any single-school roster we'll demo against.
    forkJoin({
      results: this.api.getExamResults(this.examId),
      exam: this.api.getExamById(this.examId),
      students: this.api.getStudents(0, 5000),
    }).subscribe({
      next: ({ results, exam, students }) => {
        // Set exam
        if (exam.success && exam.data) {
          this.exam = exam.data;
        }

        // Build student map
        const studentList = students.data?.content || [];
        studentList.forEach((s: any) => {
          this.studentMap[s.studentId] = {
            firstName: s.firstName || '',
            lastName: s.lastName || '',
            rollNumber: s.rollNumber,
          };
        });

        // Process results — API returns allMarks, totalStudents, passed, etc.
        const data = results.data;
        if (data) {
          this.marks = data.allMarks || [];
          this.totalStudents = data.totalStudents || this.marks.length;
          // Recompute pass/fail counters from the canonical rule rather
          // than trust the server's pre-aggregated numbers. The server
          // computed against a stale grading scale that didn't know
          // about the school's editable passingMarks override, which is
          // why the chart and the table sometimes told different stories.
          {
            const cPass = this.effectivePass;
            this.passedCount = this.marks.filter((m: any) => m.marksObtained >= cPass).length;
            this.failedCount = this.totalStudents - this.passedCount;
            this.passPercentage = this.totalStudents > 0
              ? Math.round((this.passedCount / this.totalStudents) * 100)
              : 0;
            const totalScored = this.marks.reduce((s: number, m: any) => s + (m.marksObtained || 0), 0);
            this.classAverage = this.totalStudents > 0
              ? Math.round((totalScored / this.totalStudents) * 10) / 10
              : 0;
          }

          // Grade distribution — DON'T trust the server's bucket counts.
          // The backend uses its own hardcoded grading scale that doesn't
          // know about (a) the school's editable bands from Settings →
          // Academic, (b) the rounding rule (89.5 → 90), or (c) the
          // per-exam passingMarks anchor for the F band. Recompute the
          // chart locally from the same {@link GradingService} the
          // ranked table uses so both views match — saw "F: 4" on the
          // chart while only 1 student was actually below passing.
          {
            const cMax = this.effectiveMax;
            const cPass = this.effectivePass;
            const gradeMap: Record<string, number> = {};
            for (const m of this.marks) {
              const g = this.grading.gradeFor(m.marksObtained, cMax, cPass);
              gradeMap[g] = (gradeMap[g] || 0) + 1;
            }
            // Stable display order — high → low so the chart always
            // reads A+, A, B+, B, C, D, F regardless of which letters
            // are populated.
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
            // Bring through any non-standard letters the school added
            // (rare but possible — e.g. "A++" or "X" if their scale is
            // weird) at the end of the list so they're not silently lost.
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

          // Toppers from API
          this.toppers = (data.toppers || []).map((t: any, i: number) => ({
            studentId: t.studentId,
            name: this.getStudentName(t.studentId),
            marks: t.marksObtained,
            rank: i + 1,
          }));

          // Full ranked list
          // Always recompute grade + pass from the marks + the exam's
          // own thresholds. The persisted `m.grade` and `m.passed` can
          // be stale (older grading rules baked in at save time).
          //
          // Grade F is defined as "below the school's passingMarks",
          // NOT as "below 35%". This respects the school's explicit
          // pass threshold — if the admin configured passingMarks=17
          // on a 50-mark paper, 17 must read as Pass with the lowest
          // passing letter (D). Higher letters still use percentage
          // bands (C/B/B+/A/A+) so the top of the scale stays familiar.
          const maxMarks = this.effectiveMax;
          const passingMarks = this.effectivePass;
          const sortedMarks = [...this.marks].sort((a: any, b: any) => b.marksObtained - a.marksObtained);
          this.rankedMarks = sortedMarks.map((m: any, i: number) => {
            const passed = m.marksObtained >= passingMarks;
            return {
              rank: i + 1,
              studentId: m.studentId,
              name: this.getStudentName(m.studentId),
              marks: m.marksObtained,
              grade: this.getGrade(m.marksObtained, maxMarks, passingMarks),
              passed,
              remarks: m.remarks || '',
            };
          });
        }

        this.isLoading = false;
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
    this.passedCount = this.marks.filter((m) => m.marksObtained >= passingMarks).length;
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
    this.rankedMarks = sortedMarks.map((m, i) => ({
      rank: i + 1,
      studentId: m.studentId,
      name: this.getStudentName(m.studentId),
      marks: m.marksObtained,
      grade: this.getGrade(m.marksObtained, maxMarks, passingMarks),
      passed: m.marksObtained >= passingMarks,
      remarks: m.remarks || '',
    }));
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
