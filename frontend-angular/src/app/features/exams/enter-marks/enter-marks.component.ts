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
import { SubjectService } from '../../../core/services/subject.service';

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
  classMap: Record<string, string> = {};


  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId') || '';
    this.loadClasses();
    this.loadExamAndStudents();
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
    if (this.exam?.classId) return this.classMap[this.exam.classId] || '-';
    return '-';
  }

  getSubjectName(): string {
    if (this.exam?.subjectName) return this.exam.subjectName;
    if (this.exam?.subjectId) return this.subjectService.getSubjectName(this.exam.subjectId);
    return '-';
  }

  loadExamAndStudents(): void {
    this.isLoading = true;
    // Load exam details by ID
    this.api.getExamById(this.examId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.exam = res.data;
        }
        this.loadStudents();
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam', 'Close', { duration: 3000 });
      },
    });
  }

  private loadStudents(): void {
    if (!this.exam) {
      this.isLoading = false;
      return;
    }

    // Load students - try with classId filter first, fallback to all
    this.api.getStudents(0, 100, this.exam.classId ? { classId: this.exam.classId } : undefined).subscribe({
      next: (res) => {
        let studentList = res.data?.content || [];

        // If classId filter returned empty, load all students
        if (studentList.length === 0 && this.exam.classId) {
          this.api.getStudents(0, 100).subscribe({
            next: (allRes) => {
              studentList = allRes.data?.content || [];
              this.mapStudents(studentList);
              this.isLoading = false;
            },
            error: () => { this.isLoading = false; },
          });
        } else {
          this.mapStudents(studentList);
          this.isLoading = false;
        }
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private mapStudents(studentList: any[]): void {
    this.students = studentList.map((s: any) => ({
      studentId: s.studentId,
      rollNumber: s.rollNumber || '',
      firstName: s.firstName || `Student ${s.admissionNumber || ''}`,
      lastName: s.lastName || '',
      marksObtained: null,
      remarks: '',
    }));
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
