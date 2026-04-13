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
import { MatDialogModule, MatDialog, MatDialogActions, MatDialogContent } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-exams-list',
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
  templateUrl: './exams-list.component.html',
  styleUrl: './exams-list.component.scss',
})
export class ExamsListComponent implements OnInit {
  exams: any[] = [];
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  displayedColumns = ['name', 'examType', 'class', 'subject', 'date', 'maxMarks', 'status', 'actions'];

  classFilter = '';
  subjectFilter = '';
  academicYearFilter = '';

  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  isLoading = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadExams();
    this.api.getClasses().subscribe({ next: (res) => (this.classes = res.data || []) });
    this.api.getAcademicYears().subscribe({ next: (res) => (this.academicYears = res.data || []) });
  }

  loadExams(): void {
    this.isLoading = true;
    this.api.getExams().subscribe({
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
      case 'SCHEDULED': return 'primary';
      case 'ONGOING': return 'accent';
      case 'COMPLETED': return 'primary';
      default: return '';
    }
  }

  createExam(): void {
    this.router.navigate(['/exams/new']);
  }

  editExam(exam: any): void {
    this.router.navigate(['/exams', exam.examId || exam.id, 'edit']);
  }

  enterMarks(exam: any): void {
    this.router.navigate(['/exams', exam.examId || exam.id, 'marks']);
  }

  lockMarks(exam: any): void {
    // Implementation for lock marks
  }

  viewResults(exam: any): void {
    this.router.navigate(['/exams', exam.examId || exam.id, 'results']);
  }

  deleteExam(exam: any): void {
    const examId = exam.examId || exam.id;
    if (confirm(`Are you sure you want to delete exam "${exam.name}"? This action cannot be undone.`)) {
      this.api.deleteExam(examId).subscribe({
        next: () => {
          this.snackBar.open('Exam deleted successfully', 'Close', { duration: 3000 });
          this.loadExams();
        },
        error: () => {
          this.snackBar.open('Failed to delete exam', 'Close', { duration: 3000 });
        },
      });
    }
  }

  getExamTypeLabel(examType: string): string {
    const labels: Record<string, string> = {
      UNIT_TEST: 'Unit Test',
      MID_TERM: 'Mid-Term',
      FINAL: 'Final',
      PRACTICAL: 'Practical',
    };
    return labels[examType] || examType || '-';
  }
}
