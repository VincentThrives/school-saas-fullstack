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
import { AuthService } from '../../../core/services/auth.service';
import { TenantFeatureService } from '../../../core/services/tenant-feature.service';
import { SchoolClass, AcademicYear, UserRole } from '../../../core/models';
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
  // Cached so `dateChange` and `onClassChange` can run a holiday check
  // synchronously without re-hitting the network on every keystroke.
  private cachedHolidays: any[] = [];
  private cachedEvents: any[] = [];

  /** Teacher-mode scoping. When true, only sections this teacher is the
   *  CLASS_TEACHER of (per Teacher Assignment) are shown in the dropdowns.
   *  Admin / principal users bypass. */
  private isTeacherMode = false;
  /** (classId::sectionId) keys this teacher is the CLASS_TEACHER of. Empty
   *  set when not in teacher mode OR teacher has no class-teacher
   *  assignments yet (in which case they see no sections). */
  private myClassTeacherSections = new Set<string>();

  readonly statusOptions = [
    { value: 'PRESENT', label: 'Present', icon: 'check_circle', color: '#4caf50' },
    { value: 'ABSENT', label: 'Absent', icon: 'cancel', color: '#f44336' },
    { value: 'LATE', label: 'Late', icon: 'schedule', color: '#ff9800' },
    { value: 'HALF_DAY', label: 'Half Day', icon: 'hourglass_bottom', color: '#2196f3' },
  ];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    public features: TenantFeatureService,
  ) {}

  ngOnInit(): void {
    this.isTeacherMode = this.auth.currentRole === UserRole.TEACHER;
    if (this.isTeacherMode) {
      // Pull this teacher's assignments and keep only the CLASS_TEACHER
      // rows. Year filter is intentionally omitted — the year picker on
      // this page drives loadClasses; this list is small enough to
      // filter client-side once.
      this.api.getMyTeacherAssignments().subscribe({
        next: (res) => {
          const rows = (res?.data || []) as any[];
          this.myClassTeacherSections = new Set(
            rows
              .filter(r => Array.isArray(r?.roles) && r.roles.includes('CLASS_TEACHER'))
              .map(r => `${r.classId}::${r.sectionId}`)
          );
          this.loadAcademicYears();
        },
        error: () => {
          // Profile fetch failed — fall back to no-class state rather than
          // showing every class to a teacher who shouldn't see them.
          this.myClassTeacherSections = new Set<string>();
          this.loadAcademicYears();
        },
      });
    } else {
      this.loadAcademicYears();
    }
  }

  loadAcademicYears(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = res.data || [];
        const current = this.academicYears.find((y) => y.current);
        if (current) {
          this.selectedAcademicYearId = current.academicYearId;
          this.loadClasses();
          this.loadHolidayCache();
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
      this.loadHolidayCache();
    }
  }

  /** Pull holidays + events for the year once. Subsequent date changes
   *  match against the cache without another network round-trip. */
  private loadHolidayCache(): void {
    forkJoin({
      holidays: this.api.getHolidays({ academicYearId: this.selectedAcademicYearId }).pipe(
        catchError(() => of({ data: [] as any[] } as any))),
      events: this.api.getEvents({ academicYearId: this.selectedAcademicYearId }).pipe(
        catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ holidays, events }) => {
      this.cachedHolidays = (holidays?.data as any[]) || [];
      this.cachedEvents = (events?.data as any[]) || [];
      // Re-evaluate the banner the moment the cache lands — handles the case
      // where the user arrived on the page already pointing at a holiday date.
      this.refreshHolidayBanner();
    });
  }

  /** Synchronous banner refresh against the cache. Called on date change,
   *  cache load, and any state change that could land on a holiday. */
  private refreshHolidayBanner(): void {
    const dateStr = this.formatDate(this.selectedDate);
    const match = this.findHolidayMatch(dateStr, this.cachedHolidays, this.cachedEvents);
    if (match) {
      this.isHoliday = true;
      this.holidayTitle = match.title;
      // Hide any previously-loaded student list — banner is the only message now.
      this.students = [];
      this.studentsLoaded = false;
    } else {
      this.isHoliday = false;
      this.holidayTitle = '';
    }
  }

  /** Date picker (matDatepicker) change handler. */
  onDateChange(): void {
    this.refreshHolidayBanner();
  }

  loadClasses(): void {
    this.api.getClasses(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        let raw = (res.data || []) as SchoolClass[];
        if (this.isTeacherMode) {
          // Filter to sections this teacher is class teacher of. Backend
          // re-enforces on /attendance/mark — this is UX so the dropdown
          // doesn't bait the teacher into picking something they can't save.
          raw = raw
            .map(c => ({
              ...c,
              sections: (c.sections || []).filter(s => this.isMyAssignedSection(c.classId, s.sectionId)),
            }))
            .filter(c => (c.sections || []).length > 0);
        }
        this.classes = raw;
      },
    });
  }

  /** True when the teacher has a CLASS_TEACHER assignment for this section. */
  private isMyAssignedSection(classId: string, sectionId: string): boolean {
    return this.myClassTeacherSections.has(`${classId}::${sectionId}`);
  }

  /** True when a TEACHER is logged in but has no CLASS_TEACHER assignment
   *  at all — drives the "you're not a class teacher of anything" empty
   *  state on the page so the dropdowns don't sit there looking interactive. */
  get isTeacherWithNoAssignments(): boolean {
    return this.isTeacherMode
        && !!this.selectedAcademicYearId
        && this.myClassTeacherSections.size === 0;
  }

  onClassChange(): void {
    const selectedClass = this.classes.find((c) => c.classId === this.selectedClassId);
    let sections = (selectedClass?.sections || []) as any[];
    // Already pre-filtered in loadClasses() for teachers; keep this guard
    // so any future code path that mutates `this.classes` can't slip an
    // unassigned section in.
    if (this.isTeacherMode) {
      sections = sections.filter(s => this.isMyAssignedSection(this.selectedClassId, s.sectionId));
    }
    this.sections = sections;
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
          // If SMS is live for this tenant AND the absence-alert trigger
          // is enabled AND there were absentees, mention the SMS dispatch
          // in the success message so the teacher knows parents will be
          // notified. Otherwise just confirm the save.
          const absentCount = this.summary.absent;
          const showSms = this.features.absenceAlertSms() && absentCount > 0;
          const msg = showSms
            ? `Attendance saved. SMS dispatched to parents of ${absentCount} absent student${absentCount === 1 ? '' : 's'}.`
            : 'Attendance saved successfully';
          this.snackBar.open(msg, 'Close', { duration: showSms ? 5000 : 3000 });
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
