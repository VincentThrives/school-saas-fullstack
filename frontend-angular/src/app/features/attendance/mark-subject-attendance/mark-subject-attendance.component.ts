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
import { SchoolClass, AcademicYear } from '../../../core/models';

interface TimetablePeriod {
  periodNumber: number;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  marked: boolean;
  studentCount: number;
}

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
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  classes: SchoolClass[] = [];
  sections: { name: string; capacity: number; sectionId?: string }[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  selectedDate: Date = new Date();
  today: Date = new Date();

  // Timetable periods for the selected day
  timetablePeriods: TimetablePeriod[] = [];
  selectedPeriod: TimetablePeriod | null = null;
  isLoadingPeriods = false;

  // Holiday check
  isHoliday = false;
  holidayTitle = '';

  // Students
  students: StudentAttendance[] = [];
  displayedColumns = ['rollNumber', 'name', 'status', 'remarks'];
  isLoading = false;
  isSaving = false;
  studentsLoaded = false;

  readonly statusOptions = [
    { value: 'PRESENT', label: 'Present', icon: 'check_circle', color: '#4caf50' },
    { value: 'ABSENT', label: 'Absent', icon: 'cancel', color: '#f44336' },
    { value: 'LATE', label: 'Late', icon: 'schedule', color: '#ff9800' },
  ];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadAcademicYears();
  }

  loadAcademicYears(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = res.data || [];
        const current = this.academicYears.find((y) => y.current);
        if (current) {
          this.selectedAcademicYearId = current.academicYearId;
          this.loadClasses();
        }
      },
    });
  }

  onAcademicYearChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.sections = [];
    this.timetablePeriods = [];
    this.selectedPeriod = null;
    this.students = [];
    this.studentsLoaded = false;
    this.classes = [];
    if (this.selectedAcademicYearId) {
      this.loadClasses();
    }
  }

  loadClasses(): void {
    this.api.getClasses(this.selectedAcademicYearId).subscribe({
      next: (res) => { this.classes = res.data || []; },
    });
  }

  onClassChange(): void {
    const selectedClass = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = selectedClass?.sections || [];
    this.selectedSectionId = '';
    this.timetablePeriods = [];
    this.selectedPeriod = null;
    this.students = [];
    this.studentsLoaded = false;
  }

  onSectionOrDateChange(): void {
    this.selectedPeriod = null;
    this.students = [];
    this.studentsLoaded = false;
    this.isHoliday = false;
    this.holidayTitle = '';
    if (this.selectedClassId && this.selectedSectionId) {
      this.checkHolidayAndLoad();
    }
  }

  private checkHolidayAndLoad(): void {
    const dateStr = this.getDateStr();
    this.api.getHolidays().subscribe({
      next: (res) => {
        const holidays = res.data || [];
        const match = holidays.find((h: any) => {
          const start = h.startDate;
          const end = h.endDate || h.startDate;
          return dateStr >= start && dateStr <= end;
        });
        if (match) {
          this.isHoliday = true;
          this.holidayTitle = match.title || 'Holiday';
          this.timetablePeriods = [];
        } else {
          this.isHoliday = false;
          this.holidayTitle = '';
          this.loadTimetablePeriods();
        }
      },
      error: () => {
        this.loadTimetablePeriods();
      },
    });
  }

  private getDateStr(): string {
    if (this.selectedDate instanceof Date) {
      const y = this.selectedDate.getFullYear();
      const m = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(this.selectedDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(this.selectedDate);
  }

  loadTimetablePeriods(): void {
    if (!this.selectedClassId || !this.selectedSectionId) return;

    this.isLoadingPeriods = true;
    this.timetablePeriods = [];

    const dateStr = this.getDateStr();

    this.api.getTimetablePeriods(this.selectedClassId, this.selectedSectionId, dateStr, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.timetablePeriods = res.data || [];
        this.isLoadingPeriods = false;
      },
      error: () => {
        this.timetablePeriods = [];
        this.isLoadingPeriods = false;
        this.snackBar.open('No timetable found for this class/section', 'Close', { duration: 3000 });
      },
    });
  }

  selectPeriod(period: TimetablePeriod): void {
    this.selectedPeriod = period;
    this.loadStudents();
  }

  isPeriodLocked(index: number): boolean {
    const period = this.timetablePeriods[index];
    if (!period) return true;

    const now = new Date();
    const selDate = this.selectedDate instanceof Date ? this.selectedDate : new Date(this.selectedDate);
    const isToday = selDate.toDateString() === now.toDateString();

    // Past dates: all periods open
    if (!isToday) return false;

    // Today: lock only future periods (period hasn't started yet)
    if (period.startTime) {
      const [h, m] = period.startTime.split(':').map(Number);
      const periodStart = h * 60 + m;
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (periodStart > currentMin) return true;
    }

    return false;
  }

  loadStudents(): void {
    if (!this.selectedClassId || !this.selectedSectionId) return;

    this.isLoading = true;
    this.api.getStudents(0, 200, { classId: this.selectedClassId, sectionId: this.selectedSectionId }).subscribe({
      next: (res) => {
        const studentList = res.data?.content || [];
        this.students = studentList.map((s: any) => ({
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

  saveAttendance(): void {
    if (!this.selectedPeriod || this.students.length === 0) {
      this.snackBar.open('Select a period and load students first', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const dateStr = this.getDateStr();

    this.api.markAttendance({
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId,
      academicYearId: this.selectedAcademicYearId,
      date: dateStr,
      subjectId: this.selectedPeriod.subjectId,
      teacherId: this.selectedPeriod.teacherId,
      periodNumber: this.selectedPeriod.periodNumber,
      entries: this.students.map((s) => ({
        studentId: s.studentId,
        status: s.status,
        remarks: s.remarks || '',
      })),
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Attendance saved successfully!', 'Close', { duration: 3000 });
        // Refresh periods to show "marked" status
        this.loadTimetablePeriods();
        this.selectedPeriod = null;
        this.students = [];
        this.studentsLoaded = false;
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Save attendance error:', err);
        this.snackBar.open(err?.error?.message || 'Failed to save attendance', 'Close', { duration: 5000 });
      },
    });
  }
}
