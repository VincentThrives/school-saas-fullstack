import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-mcq-exams-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './mcq-exams-list.component.html',
  styleUrl: './mcq-exams-list.component.scss',
})
export class McqExamsListComponent implements OnInit {
  exams: any[] = [];
  displayedColumns = ['title', 'subject', 'totalQuestions', 'duration', 'status', 'actions'];
  isLoading = false;
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  statusFilter = '';

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadExams();
  }

  loadExams(): void {
    this.isLoading = true;
    this.api.getMcqExams().subscribe({
      next: (res) => {
        this.exams = res.data || [];
        this.totalElements = this.exams.length;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'DRAFT': return 'default';
      case 'PUBLISHED': return 'info';
      case 'ONGOING': return 'warning';
      case 'COMPLETED': return 'success';
      default: return 'default';
    }
  }

  createExam(): void {
    this.router.navigate(['/mcq/new']);
  }

  goToQuestionBank(): void {
    this.router.navigate(['/mcq/questions']);
  }

  editExam(exam: any): void {
    this.router.navigate(['/mcq', exam.examId || exam.id, 'edit']);
  }

  publishExam(exam: any): void {
    this.snackBar.open('Exam published successfully', 'Close', { duration: 3000 });
    this.loadExams();
  }

  viewResults(exam: any): void {
    this.router.navigate(['/mcq', exam.examId || exam.id, 'results']);
  }
}
