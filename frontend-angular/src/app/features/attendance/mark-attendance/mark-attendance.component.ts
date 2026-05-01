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
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface StudentAttendance {
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
  remarks: string;
}

@Component({
  selector: 'app-mark-attendance',
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
  templateUrl: './mark-attendance.component.html',
  styleUrl: './mark-attendance.component.scss',
})
export class MarkAttendanceComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  classes: SchoolClass[] = [];
  sections: { name: string; capacity: number; sectionId?: string }[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  selectedDate: Date = new Date();
  today: Date = new Date();
  students: StudentAttendance[] = [];
  displayedColumns = ['rollNumber', 'name', 'status', 'remarks'];
  isLoading = false;
  isSaving = false;
  studentsLoaded = false;
  isHoliday = false;
  holidayTitle = '';

  readonly statusOptions = [
    { value: 'PRESENT', label: 'Present', icon: 'check_circle', color: '#4caf50' },
    { value: 'ABSENT', label: 'Absent', icon: 'cancel', color: '#f44336' },
    { value: 'LATE', label: 'Late', icon: 'schedule', color: '#ff9800' },
    { value: 'HALF_DAY', label: 'Half Day', icon: 'hourglass_bottom', color: '#2196f3' },
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
    this.students = [];
    this.studentsLoaded = false;
    this.classes = [];
    if (this.selectedAcademicYearId) {
      this.loadClasses();
    }
  }

  loadClasses(): void {
    this.api.getClasses(this.selectedAcademicYearId).subscribe({
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

    // Check for a holiday first — match against BOTH the dedicated holidays
    // list AND any event flagged as type=HOLIDAY. Schools sometimes add
    // single-day closures via the Events page, and we want those to block
    // attendance the same way as a Holiday-list entry.
    const dateStr = this.formatDate(this.selectedDate);
    forkJoin({
      holidays: this.api.getHolidays().pipe(catchError(() => of({ data: [] as any[] } as any))),
      events: this.api.getEvents().pipe(catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ holidays, events }) => {
      const match = this.findHolidayMatch(dateStr,
        (holidays?.data as any[]) || [], (events?.data as any[]) || []);
      if (match) {
        this.isHoliday = true;
        this.holidayTitle = match.title;
        this.students = [];
        this.studentsLoaded = false;
        this.isLoading = false;
        return;
      }
      this.isHoliday = false;
      this.holidayTitle = '';
      this.fetchStudents();
    });
  }

  /** Returns the matching holiday/event record (with normalized title) for
   *  the given ISO date, or null if the day is a working day.
   *
   *  Holiday-list entries always count. Event-list entries count only when
   *  the event is explicitly tagged as a holiday (type/kind === 'HOLIDAY' or
   *  isHoliday === true) — generic events like "Sports Day" must not block
   *  attendance. */
  private findHolidayMatch(dateStr: string, holidays: any[], events: any[]): { title: string } | null {
    for (const h of holidays) {
      const start = h.startDate || h.date;
      const end = h.endDate || start;
      if (start && dateStr >= start && dateStr <= end) {
        return { title: h.title || h.name || 'Holiday' };
      }
    }
    for (const e of events) {
      const isHoliday = e.type === 'HOLIDAY' || e.kind === 'HOLIDAY' || e.isHoliday === true;
      if (!isHoliday) continue;
      const start = e.startDate || e.date || e.eventDate;
      const end = e.endDate || start;
      if (start && dateStr >= start && dateStr <= end) {
        return { title: e.title || e.name || 'Holiday' };
      }
    }
    return null;
  }

  private fetchStudents(): void {
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

  get summary(): { present: number; absent: number; late: number; halfDay: number } {
    return this.students.reduce(
      (acc, s) => {
        if (s.status === 'PRESENT') acc.present++;
        else if (s.status === 'ABSENT') acc.absent++;
        else if (s.status === 'LATE') acc.late++;
        else if (s.status === 'HALF_DAY') acc.halfDay++;
        return acc;
      },
      { present: 0, absent: 0, late: 0, halfDay: 0 },
    );
  }

  saveAttendance(): void {
    if (this.students.length === 0) return;

    this.isSaving = true;
    const dateStr = this.formatDate(this.selectedDate);

    this.api
      .markAttendance({
        classId: this.selectedClassId,
        sectionId: this.selectedSectionId,
        academicYearId: this.selectedAcademicYearId,
        date: dateStr,
        entries: this.students.map((s) => ({
          studentId: s.studentId,
          status: s.status,
          remarks: s.remarks || '',
        })),
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.snackBar.open('Attendance saved successfully', 'Close', { duration: 3000 });
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open(err?.error?.message || 'Failed to save attendance', 'Close', { duration: 3000 });
        },
      });
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
