import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface AvailableExam {
  examId: string;
  title: string;
  subjectName: string;
  duration: number;
  totalQuestions: number;
  endTime: string;
  isCompleted?: boolean;
  score?: number;
}

@Component({
  selector: 'app-available-mcq-exams',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './available-mcq-exams.component.html',
  styleUrl: './available-mcq-exams.component.scss',
})
export class AvailableMcqExamsComponent implements OnInit {
  exams: AvailableExam[] = [];
  isLoading = false;

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadExams();
  }

  loadExams(): void {
    this.isLoading = true;
    this.api.getExams().subscribe({
      next: (res) => {
        this.exams = (res.data || []).map((e: any) => ({
          examId: e.examId || e.id,
          title: e.title || e.name,
          subjectName: e.subjectName || '-',
          duration: e.duration || 30,
          totalQuestions: e.questionIds?.length || e.totalQuestions || 0,
          endTime: e.endTime || '',
          isCompleted: e.isCompleted || false,
          score: e.score,
        }));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  startExam(examId: string): void {
    this.router.navigate(['/mcq/take', examId]);
  }
}
