import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Assignment, AssignmentSubmission, UserRole } from '../../../core/models';

@Component({
  selector: 'app-assignment-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    PageHeaderComponent,
  ],
  templateUrl: './assignment-detail.component.html',
  styleUrl: './assignment-detail.component.scss',
})
export class AssignmentDetailComponent implements OnInit {
  assignment: Assignment | null = null;
  submissions: AssignmentSubmission[] = [];
  submissionColumns = ['studentName', 'submittedAt', 'status', 'marks', 'actions'];
  isLoading = false;

  // Student submission
  answer = '';
  selectedFile: File | null = null;
  isSubmitting = false;

  // Grading
  gradingSubmissionId = '';
  gradeMarks = 0;
  gradeFeedback = '';
  isGrading = false;

  get isTeacher(): boolean {
    const role = this.authService.currentRole;
    return role === UserRole.TEACHER || role === UserRole.SCHOOL_ADMIN || role === UserRole.PRINCIPAL;
  }

  get isStudent(): boolean {
    return this.authService.currentRole === UserRole.STUDENT;
  }

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('assignmentId');
    if (id) {
      this.loadAssignment(id);
    }
  }

  loadAssignment(id: string): void {
    this.isLoading = true;
    this.api.getAssignmentById(id).subscribe({
      next: (res) => {
        this.assignment = res.data;
        this.isLoading = false;
        if (this.isTeacher) {
          this.loadSubmissions(id);
        }
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  loadSubmissions(assignmentId: string): void {
    this.api.getAssignmentSubmissions(assignmentId).subscribe({
      next: (res) => {
        this.submissions = res.data || [];
      },
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'SUBMITTED': return 'status-submitted';
      case 'GRADED': return 'status-graded';
      case 'LATE': return 'status-late';
      case 'PENDING': return 'status-pending';
      default: return '';
    }
  }

  // Student submission
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  submitAssignment(): void {
    if (!this.assignment) return;
    this.isSubmitting = true;
    const formData = new FormData();
    formData.append('answer', this.answer);
    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }
    this.api.submitAssignment(this.assignment.assignmentId, formData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.answer = '';
        this.selectedFile = null;
      },
      error: () => {
        this.isSubmitting = false;
      },
    });
  }

  // Grading
  startGrading(submission: AssignmentSubmission): void {
    this.gradingSubmissionId = submission.submissionId;
    this.gradeMarks = submission.marks || 0;
    this.gradeFeedback = submission.feedback || '';
  }

  cancelGrading(): void {
    this.gradingSubmissionId = '';
  }

  saveGrade(): void {
    if (!this.assignment || !this.gradingSubmissionId) return;
    this.isGrading = true;
    this.api.gradeSubmission(this.assignment.assignmentId, this.gradingSubmissionId, {
      marks: this.gradeMarks,
      feedback: this.gradeFeedback,
    }).subscribe({
      next: () => {
        this.isGrading = false;
        this.gradingSubmissionId = '';
        this.loadSubmissions(this.assignment!.assignmentId);
      },
      error: () => {
        this.isGrading = false;
      },
    });
  }
}
