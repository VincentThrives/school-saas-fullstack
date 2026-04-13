import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface MarkRow {
  examName: string;
  subjectId: string;
  examDate: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
}

@Component({
  selector: 'app-child-marks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './child-marks.component.html',
  styleUrl: './child-marks.component.scss',
})
export class ChildMarksComponent implements OnInit {
  marks: MarkRow[] = [];
  examsMap: Record<string, any> = {};
  isLoading = false;
  displayedColumns = ['examName', 'subject', 'date', 'marks', 'percentage', 'grade', 'status'];

  // Student selector
  students: { id: string; name: string }[] = [];
  selectedStudentId = '';

  // Summary
  totalExams = 0;
  averagePercentage = 0;
  bestSubject = '-';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadExams();
  }

  private loadExams(): void {
    this.api.getExams().subscribe({
      next: (res) => {
        const exams = res.data || [];
        exams.forEach((e: any) => {
          this.examsMap[e.examId] = e;
        });
      },
    });
  }

  onStudentSelected(): void {
    if (!this.selectedStudentId) {
      this.marks = [];
      return;
    }
    this.loadMarks(this.selectedStudentId);
  }

  loadMarksForStudent(studentId: string): void {
    this.selectedStudentId = studentId;
    this.loadMarks(studentId);
  }

  private loadMarks(studentId: string): void {
    this.isLoading = true;
    this.api.getStudentExamMarks(studentId).subscribe({
      next: (res) => {
        const rawMarks = res.data || [];
        this.marks = rawMarks.map((m: any) => {
          const exam = this.examsMap[m.examId] || {};
          const maxMarks = exam.maxMarks || 100;
          const pct = maxMarks > 0 ? (m.marksObtained / maxMarks) * 100 : 0;
          return {
            examName: exam.name || 'Unknown Exam',
            subjectId: exam.subjectId || '-',
            examDate: exam.examDate || '',
            marksObtained: m.marksObtained,
            maxMarks: maxMarks,
            percentage: Math.round(pct * 10) / 10,
            grade: m.grade || '-',
            passed: m.passed ?? m.isPassed ?? false,
          };
        });

        this.computeSummary();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private computeSummary(): void {
    if (this.marks.length === 0) {
      this.totalExams = 0;
      this.averagePercentage = 0;
      this.bestSubject = '-';
      return;
    }

    const examNames = new Set(this.marks.map((m) => m.examName));
    this.totalExams = examNames.size;

    const totalPct = this.marks.reduce((sum, m) => sum + m.percentage, 0);
    this.averagePercentage = Math.round((totalPct / this.marks.length) * 10) / 10;

    const subjectPcts: Record<string, { total: number; count: number }> = {};
    this.marks.forEach((m) => {
      if (!subjectPcts[m.subjectId]) subjectPcts[m.subjectId] = { total: 0, count: 0 };
      subjectPcts[m.subjectId].total += m.percentage;
      subjectPcts[m.subjectId].count++;
    });
    let bestAvg = 0;
    this.bestSubject = '-';
    Object.entries(subjectPcts).forEach(([subj, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        this.bestSubject = subj;
      }
    });
  }

  getGradeClass(grade: string): string {
    if (grade === 'A+' || grade === 'A') return 'grade-green';
    if (grade === 'B+' || grade === 'B') return 'grade-blue';
    if (grade === 'C' || grade === 'D') return 'grade-orange';
    return 'grade-red';
  }
}
