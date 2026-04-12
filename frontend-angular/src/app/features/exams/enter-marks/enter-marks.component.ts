import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface StudentMark {
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  marksObtained: number | null;
  remarks: string;
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
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './enter-marks.component.html',
  styleUrl: './enter-marks.component.scss',
})
export class EnterMarksComponent implements OnInit {
  examId: string = '';
  exam: any = null;
  students: StudentMark[] = [];
  displayedColumns = ['rollNumber', 'name', 'marksObtained', 'status', 'remarks'];
  isLoading = false;
  isSaving = false;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId') || '';
    this.loadExamAndStudents();
  }

  loadExamAndStudents(): void {
    this.isLoading = true;
    // Load exam details
    this.api.getExams().subscribe({
      next: (res) => {
        const exams = res.data || [];
        this.exam = exams.find((e: any) => (e.examId || e.id) === this.examId);
        this.loadStudents();
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private loadStudents(): void {
    if (!this.exam?.classId) {
      this.isLoading = false;
      return;
    }

    this.api.getStudents(0, 100, { classId: this.exam.classId }).subscribe({
      next: (res) => {
        const studentList = res.data?.content || [];
        this.students = studentList.map((s) => ({
          studentId: s.studentId,
          rollNumber: s.rollNumber || '',
          firstName: s.userId,
          lastName: '',
          marksObtained: null,
          remarks: '',
        }));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  get maxMarks(): number {
    return this.exam?.maxMarks || 100;
  }

  get passingMarks(): number {
    return this.exam?.passingMarks || 35;
  }

  isPassing(marks: number | null): boolean {
    return marks !== null && marks >= this.passingMarks;
  }

  getGrade(marks: number | null): string {
    if (marks === null) return '-';
    const percentage = (marks / this.maxMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 35) return 'D';
    return 'F';
  }

  onMarksChange(student: StudentMark, value: string): void {
    const numVal = value === '' ? null : parseInt(value, 10);
    if (numVal !== null && (numVal < 0 || numVal > this.maxMarks)) return;
    student.marksObtained = numVal;
  }

  saveMarks(): void {
    const validMarks = this.students
      .filter((s) => s.marksObtained !== null)
      .map((s) => ({
        studentId: s.studentId,
        subjectId: this.exam?.subjectId || '',
        marksObtained: s.marksObtained as number,
      }));

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
    this.router.navigate(['/exams']);
  }
}
