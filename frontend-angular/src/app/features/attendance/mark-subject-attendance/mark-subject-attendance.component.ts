import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass } from '../../../core/models';

interface StudentAttendance {
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  remarks: string;
}

@Component({
  selector: 'app-mark-subject-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatRadioModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './mark-subject-attendance.component.html',
  styleUrl: './mark-subject-attendance.component.scss',
})
export class MarkSubjectAttendanceComponent implements OnInit {
  classes: SchoolClass[] = [];
  sections: { name: string; capacity: number; sectionId?: string }[] = [];
  subjects: SubjectItem[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  selectedDate: Date = new Date();
  selectedSubjectId = '';
  selectedPeriod = 0;
  students: StudentAttendance[] = [];
  displayedColumns = ['rollNumber', 'name', 'status', 'remarks'];
  isLoading = false;
  isSaving = false;
  studentsLoaded = false;

  readonly periodOptions = [1, 2, 3, 4, 5, 6, 7, 8];

  readonly statusOptions = [
    { value: 'PRESENT', label: 'Present', icon: 'check_circle', color: '#4caf50' },
    { value: 'ABSENT', label: 'Absent', icon: 'cancel', color: '#f44336' },
    { value: 'LATE', label: 'Late', icon: 'schedule', color: '#ff9800' },
  ];

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.subjectService.getSubjects().subscribe((subjects) => {
      this.subjects = subjects;
    });
  }

  loadClasses(): void {
    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = res.data || [];
      },
    });
  }

  onClassChange(): void {
    const selectedClass = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = selectedClass?.sections || [];
    this.selectedSectionId = '';
    this.students = [];
    this.studentsLoaded = false;
  }

  loadStudents(): void {
    if (!this.selectedClassId || !this.selectedSectionId) return;

    this.isLoading = true;
    this.api
      .getStudents(0, 100, { classId: this.selectedClassId, sectionId: this.selectedSectionId })
      .subscribe({
        next: (res) => {
          const studentList = res.data?.content || [];
          this.students = studentList.map((s) => ({
            studentId: s.studentId,
            rollNumber: s.rollNumber || '',
            firstName: s.firstName || `Student ${s.admissionNumber || ''}`,
            lastName: s.lastName || '',
            status: 'PRESENT' as const,
            remarks: '',
          }));
          this.studentsLoaded = true;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open('Failed to load students', 'Close', { duration: 3000 });
        },
      });
  }

  markAllPresent(): void {
    this.students = this.students.map((s) => ({ ...s, status: 'PRESENT' as const }));
  }

  get summary(): { present: number; absent: number; late: number } {
    return this.students.reduce(
      (acc, s) => {
        if (s.status === 'PRESENT') acc.present++;
        else if (s.status === 'ABSENT') acc.absent++;
        else if (s.status === 'LATE') acc.late++;
        return acc;
      },
      { present: 0, absent: 0, late: 0 },
    );
  }

  get selectedSubjectName(): string {
    const subject = this.subjects.find((s) => s.subjectId === this.selectedSubjectId);
    return subject?.name || '';
  }

  saveAttendance(): void {
    if (this.students.length === 0) {
      this.snackBar.open('No students to save', 'Close', { duration: 3000 });
      return;
    }
    if (!this.selectedSubjectId) {
      this.snackBar.open('Please select a subject', 'Close', { duration: 3000 });
      return;
    }
    if (!this.selectedPeriod) {
      this.snackBar.open('Please select a period', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;

    // Handle date
    let dateStr: string;
    if (this.selectedDate instanceof Date) {
      const y = this.selectedDate.getFullYear();
      const m = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(this.selectedDate.getDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    } else {
      dateStr = String(this.selectedDate);
    }

    this.api
      .markAttendance({
        classId: this.selectedClassId,
        sectionId: this.selectedSectionId,
        academicYearId: this.classes.find((c: any) => c.classId === this.selectedClassId)?.academicYearId || '',
        date: dateStr,
        subjectId: this.selectedSubjectId,
        subjectName: this.selectedSubjectName,
        periodNumber: this.selectedPeriod,
        entries: this.students.map((s) => ({
          studentId: s.studentId,
          status: s.status,
          remarks: s.remarks || '',
        })),
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.snackBar.open('Subject attendance saved successfully!', 'Close', { duration: 3000 });
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open(err?.error?.message || 'Failed to save attendance', 'Close', { duration: 3000 });
        },
      });
  }
}
