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
  subjectNames: Record<string, string> = {
    math: 'Mathematics', maths: 'Mathematics', science: 'Science', english: 'English',
    hindi: 'Hindi', kannada: 'Kannada', sanskrit: 'Sanskrit',
    social: 'Social Science', history: 'History', geography: 'Geography',
    physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology',
    computer: 'Computer Science', evs: 'EVS', pe: 'Physical Education',
    'math-101': 'Mathematics',
  };
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

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId') || '';
    this.loadClasses();
    this.loadResults();
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
    if (this.exam?.subjectId) return this.subjectNames[this.exam.subjectId] || this.exam.subjectId;
    return '-';
  }

  loadResults(): void {
    this.isLoading = true;

    forkJoin({
      results: this.api.getExamResults(this.examId),
      exam: this.api.getExamById(this.examId),
      students: this.api.getStudents(0, 200),
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
          this.passedCount = data.passed || 0;
          this.failedCount = data.failed || 0;
          this.passPercentage = data.passPercentage || 0;
          this.classAverage = data.classAverage || 0;

          // Grade distribution from API
          const gradeDist = data.gradeDistribution || {};
          const gradeColors: Record<string, string> = {
            'A+': '#4caf50', A: '#66bb6a', 'B+': '#42a5f5', B: '#64b5f6',
            C: '#ffa726', D: '#ff7043', F: '#ef5350',
          };
          this.gradeDistribution = Object.entries(gradeDist).map(([grade, count]) => ({
            grade,
            count: count as number,
            color: gradeColors[grade] || '#9e9e9e',
          }));

          // Toppers from API
          this.toppers = (data.toppers || []).map((t: any, i: number) => ({
            studentId: t.studentId,
            name: this.getStudentName(t.studentId),
            marks: t.marksObtained,
            rank: i + 1,
          }));

          // Full ranked list
          const sortedMarks = [...this.marks].sort((a: any, b: any) => b.marksObtained - a.marksObtained);
          this.rankedMarks = sortedMarks.map((m: any, i: number) => ({
            rank: i + 1,
            studentId: m.studentId,
            name: this.getStudentName(m.studentId),
            marks: m.marksObtained,
            grade: m.grade || this.getGrade(m.marksObtained, this.exam?.maxMarks || 100),
            passed: m.passed ?? m.marksObtained >= (this.exam?.passingMarks || 35),
            remarks: m.remarks || '',
          }));
        }

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private computeStats(): void {
    const maxMarks = this.exam?.maxMarks || 100;
    const passingMarks = this.exam?.passingMarks || 35;

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
      const grade = this.getGrade(m.marksObtained, maxMarks);
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
      grade: this.getGrade(m.marksObtained, maxMarks),
      passed: m.marksObtained >= passingMarks,
      remarks: m.remarks || '',
    }));
  }

  getStudentName(studentId: string): string {
    const s = this.studentMap[studentId];
    if (s) {
      return `${s.firstName} ${s.lastName}`.trim() || studentId;
    }
    return studentId;
  }

  getGrade(marks: number, maxMarks: number): string {
    const percentage = (marks / maxMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 35) return 'D';
    return 'F';
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
