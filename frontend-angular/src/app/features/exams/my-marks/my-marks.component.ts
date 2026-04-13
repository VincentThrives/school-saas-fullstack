import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
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
  selector: 'app-my-marks',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-marks.component.html',
  styleUrl: './my-marks.component.scss',
})
export class MyMarksComponent implements OnInit {
  marks: MarkRow[] = [];
  examsMap: Record<string, any> = {};
  isLoading = false;
  displayedColumns = ['examName', 'subject', 'date', 'marks', 'percentage', 'grade', 'status'];

  // Summary
  totalExams = 0;
  averagePercentage = 0;
  bestSubject = '-';
  overallGrade = '-';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading = true;

    // Load exams first to get names
    this.api.getExams().subscribe({
      next: (examsRes) => {
        const exams = examsRes.data || [];
        exams.forEach((e: any) => {
          this.examsMap[e.examId] = e;
        });

        // Then load marks
        this.api.getMyMarks().subscribe({
          next: (marksRes) => {
            const rawMarks = marksRes.data || [];
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
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private computeSummary(): void {
    if (this.marks.length === 0) return;

    const examNames = new Set(this.marks.map((m) => m.examName));
    this.totalExams = examNames.size;

    const totalPct = this.marks.reduce((sum, m) => sum + m.percentage, 0);
    this.averagePercentage = Math.round((totalPct / this.marks.length) * 10) / 10;

    // Best subject by average percentage
    const subjectPcts: Record<string, { total: number; count: number }> = {};
    this.marks.forEach((m) => {
      if (!subjectPcts[m.subjectId]) subjectPcts[m.subjectId] = { total: 0, count: 0 };
      subjectPcts[m.subjectId].total += m.percentage;
      subjectPcts[m.subjectId].count++;
    });
    let bestAvg = 0;
    Object.entries(subjectPcts).forEach(([subj, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        this.bestSubject = subj;
      }
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
}
