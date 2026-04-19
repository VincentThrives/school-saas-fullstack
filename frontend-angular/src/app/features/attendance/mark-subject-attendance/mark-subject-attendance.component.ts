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
import { SchoolClass, AcademicYear, UserRole } from '../../../core/models';

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
  // Stamped in teacher-mode auto-load so selecting a card knows its class/section
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  academicYearId?: string;
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
  /** True when we loaded pre-existing marks for the currently selected period. */
  isAlreadyMarked = false;

  // Teacher-mode state
  isTeacherMode = false;
  teacherUserId = '';
  teacherName = '';
  showFilters = true;            // admins: always true; teachers: false until fallback triggers
  autoLoadAttempted = false;     // true once teacher auto-load has run
  autoLoadEmpty = false;         // true when teacher auto-load returned zero periods for today
  private cachedTeacherTimetables: any[] = [];   // cached to re-filter on date change without re-fetching

  readonly statusOptions = [
    { value: 'PRESENT', label: 'Present', icon: 'check_circle', color: '#4caf50' },
    { value: 'ABSENT', label: 'Absent', icon: 'cancel', color: '#f44336' },
    { value: 'LATE', label: 'Late', icon: 'schedule', color: '#ff9800' },
  ];

  /** Label for a period card. Looks in three places in priority order:
   *  1. The period's own stamped className/sectionName.
   *  2. The classes list resolved by the period's classId/sectionId
   *     (works for teacher auto-load even when the Timetable didn't carry names).
   *  3. The currently-selected class+section from the dropdowns.
   *  Guarantees the pill is filled whenever we know the class/section at all. */
  periodClassLabel(p: TimetablePeriod): string {
    if (p.className) {
      return p.className + (p.sectionName ? ' — ' + p.sectionName : '');
    }
    // Resolve from the period's own ids.
    if (p.classId) {
      const cls = this.classes.find(c => c.classId === p.classId);
      if (cls) {
        const sec = (cls.sections || []).find((s: any) => s.sectionId === p.sectionId) as any;
        return cls.name + (sec?.name ? ' — ' + sec.name : '');
      }
    }
    // Fall back to the currently-selected class+section (admin path).
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    const sec = (cls?.sections || []).find((s: any) => s.sectionId === this.selectedSectionId) as any;
    if (!cls) return '';
    return cls.name + (sec?.name ? ' — ' + sec.name : '');
  }

  private readonly DAY_KEYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const role = this.authService.currentRole;
    const user = this.authService.currentUser;
    this.isTeacherMode = role === UserRole.TEACHER;

    if (this.isTeacherMode) {
      this.teacherUserId = user?.userId || '';
      this.teacherName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Teacher';
      this.showFilters = false;
      this.runTeacherAutoLoad();
    } else {
      // Admin flow (unchanged)
      this.showFilters = true;
      this.loadAcademicYears();
    }
  }

  /**
   * Teacher fast path:
   *   1. Resolve the current academic year (silently).
   *   2. Fetch the teacher's own timetables for that year.
   *   3. Flatten today's periods (stamping classId/sectionId/year onto each card).
   *   4. If nothing found → auto-reveal the filter dropdowns as fallback.
   */
  private runTeacherAutoLoad(): void {
    if (!this.teacherUserId) {
      this.autoLoadAttempted = true;
      this.autoLoadEmpty = true;
      this.showFilters = true;
      this.loadAcademicYears();
      return;
    }

    this.isLoadingPeriods = true;

    this.api.getAcademicYears().subscribe({
      next: (ayRes) => {
        this.academicYears = ayRes.data || [];
        const current = this.academicYears.find((y) => y.current) || this.academicYears[0];

        if (!current) {
          this.finishAutoLoadEmpty();
          return;
        }
        this.selectedAcademicYearId = current.academicYearId;

        // Load classes in parallel so periodClassLabel() can resolve
        // className/sectionName from a period's classId/sectionId even when
        // the Timetable didn't carry those names.
        this.api.getClasses(this.selectedAcademicYearId).subscribe({
          next: (res) => { this.classes = res.data || []; this.applyTeacherDayFilter(); },
        });

        this.api.getTeacherTimetable(this.teacherUserId, this.selectedAcademicYearId).subscribe({
          next: (res) => {
            this.cachedTeacherTimetables = res.data || [];
            this.applyTeacherDayFilter();
            this.isLoadingPeriods = false;
            this.autoLoadAttempted = true;
            if (this.timetablePeriods.length === 0) {
              this.autoLoadEmpty = true;
              this.showFilters = true;          // reveal dropdowns as fallback
              this.loadClassesForFallback();
            }
          },
          error: () => {
            this.finishAutoLoadEmpty();
          },
        });
      },
      error: () => {
        this.finishAutoLoadEmpty();
      },
    });
  }

  private finishAutoLoadEmpty(): void {
    this.isLoadingPeriods = false;
    this.autoLoadAttempted = true;
    this.autoLoadEmpty = true;
    this.showFilters = true;
    this.loadClassesForFallback();
  }

  private loadClassesForFallback(): void {
    if (this.selectedAcademicYearId) {
      this.loadClasses();
    } else {
      this.loadAcademicYears();
    }
  }

  /**
   * Re-filter the cached teacher timetables against the currently selected date.
   * Called on initial load and whenever the teacher changes the date.
   */
  private applyTeacherDayFilter(): void {
    const dayKey = this.getDayKey(this.selectedDate);
    const periods: TimetablePeriod[] = [];

    for (const tt of this.cachedTeacherTimetables) {
      const daySched = (tt?.schedule || []).find((d: any) => (d?.dayOfWeek || '').toUpperCase() === dayKey);
      if (!daySched || !daySched.periods) continue;

      for (const p of daySched.periods) {
        if (p.teacherId !== this.teacherUserId) continue;
        periods.push({
          periodNumber: p.periodNumber,
          subjectId: p.subjectId,
          subjectName: p.subjectName,
          teacherId: p.teacherId,
          teacherName: p.teacherName,
          startTime: p.startTime,
          endTime: p.endTime,
          marked: false,
          studentCount: 0,
          classId: tt.classId,
          className: tt.className,
          sectionId: tt.sectionId,
          sectionName: tt.sectionName,
          academicYearId: tt.academicYearId,
        });
      }
    }

    periods.sort((a, b) => a.periodNumber - b.periodNumber);
    this.timetablePeriods = periods;
    this.selectedPeriod = null;
    this.students = [];
    this.studentsLoaded = false;
    this.isAlreadyMarked = false;

    // Stamp "marked" + "studentCount" on each card by looking at what's saved.
    this.stampMarkedFlagsOnPeriods();
  }

  /**
   * For each unique (classId, sectionId) in the current period list, fetch
   * the saved attendance for the selected date and stamp `marked` /
   * `studentCount` on matching cards. One API call per class+section pair.
   */
  private stampMarkedFlagsOnPeriods(): void {
    const dateStr = this.getDateStr();
    const pairs = new Set<string>();
    this.timetablePeriods.forEach(p => {
      if (p.classId && p.sectionId) pairs.add(`${p.classId}::${p.sectionId}`);
    });
    pairs.forEach(key => {
      const [classId, sectionId] = key.split('::');
      this.api.getBatchAttendance(classId, sectionId, dateStr).subscribe({
        next: (res) => {
          const records = res?.data || [];
          this.timetablePeriods.forEach(p => {
            if (p.classId !== classId || p.sectionId !== sectionId) return;
            const match = records.find((r: any) =>
              r.periodNumber === p.periodNumber
              && (!r.subjectId || !p.subjectId || r.subjectId === p.subjectId));
            if (match) {
              p.marked = true;
              p.studentCount = (match.entries || []).length;
            }
          });
        },
        error: () => { /* non-fatal; cards simply won't show "Marked" */ },
      });
    });
  }

  private getDayKey(date: Date): string {
    const d = date instanceof Date ? date : new Date(date);
    return this.DAY_KEYS[d.getDay()];
  }

  /** Teacher mode: change date → re-filter cached timetables (no network call). */
  onTeacherDateChange(): void {
    if (!this.isTeacherMode) return;
    this.applyTeacherDayFilter();
    if (this.timetablePeriods.length === 0) {
      this.autoLoadEmpty = true;
      this.showFilters = true;
      this.loadClassesForFallback();
    } else {
      this.autoLoadEmpty = false;
    }
  }

  /** Manual toggle so a teacher can open filters even when auto-loaded cards exist. */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    if (this.showFilters) this.loadClassesForFallback();
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
    this.isAlreadyMarked = false;
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
    this.selectedSectionId = '';
    this.timetablePeriods = [];
    this.selectedPeriod = null;
    this.students = [];
    this.studentsLoaded = false;
    this.isAlreadyMarked = false;

    // Special sentinel: "All Classes" — load periods across every class+section
    // in the selected academic year, aggregated in one list.
    if (this.selectedClassId === 'ALL') {
      this.sections = [];
      this.loadPeriodsForAllClasses();
      return;
    }

    const selectedClass = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = selectedClass?.sections || [];
  }

  /**
   * For each (class, section) pair that exists in the selected academic year,
   * fetch its timetable periods for the chosen date and flatten them into one
   * list. Each card carries its own classId/sectionId so selectPeriod() scopes
   * correctly.
   */
  private loadPeriodsForAllClasses(): void {
    this.isLoadingPeriods = true;
    this.isHoliday = false;
    this.holidayTitle = '';

    const dateStr = this.getDateStr();

    // First check holiday once — no need to fetch timetables on a holiday.
    this.api.getHolidays().subscribe({
      next: (res) => {
        const holidays = res.data || [];
        const isHoliday = holidays.some((h: any) => {
          const s = h.startDate;
          const e = h.endDate || h.startDate;
          return dateStr >= s && dateStr <= e;
        });
        if (isHoliday) {
          const match = holidays.find((h: any) => {
            const s = h.startDate;
            const e = h.endDate || h.startDate;
            return dateStr >= s && dateStr <= e;
          });
          this.isHoliday = true;
          this.holidayTitle = match?.title || 'Holiday';
          this.isLoadingPeriods = false;
          return;
        }
        this.fetchTimetablesAcrossAllClasses(dateStr);
      },
      error: () => this.fetchTimetablesAcrossAllClasses(dateStr),
    });
  }

  private fetchTimetablesAcrossAllClasses(dateStr: string): void {
    const pairs: { classId: string; sectionId: string; className: string; sectionName: string }[] = [];
    for (const cls of this.classes) {
      for (const sec of (cls.sections || []) as any[]) {
        if (!sec.sectionId) continue;
        pairs.push({
          classId: cls.classId,
          sectionId: sec.sectionId,
          className: cls.name,
          sectionName: sec.name,
        });
      }
    }

    if (pairs.length === 0) {
      this.timetablePeriods = [];
      this.isLoadingPeriods = false;
      return;
    }

    let completed = 0;
    const aggregated: TimetablePeriod[] = [];

    pairs.forEach((pair) => {
      this.api.getTimetablePeriods(pair.classId, pair.sectionId, dateStr, this.selectedAcademicYearId).subscribe({
        next: (res) => {
          (res?.data || []).forEach((p: any) => {
            // In teacher mode, only include periods this teacher actually teaches.
            // Otherwise "All Classes" would show every period from every
            // teacher, which is not what a logged-in teacher should see.
            if (this.isTeacherMode && p.teacherId !== this.teacherUserId) return;

            aggregated.push({
              periodNumber: p.periodNumber,
              subjectId: p.subjectId,
              subjectName: p.subjectName,
              teacherId: p.teacherId,
              teacherName: p.teacherName,
              startTime: p.startTime,
              endTime: p.endTime,
              marked: !!p.marked,
              studentCount: p.studentCount || 0,
              classId: pair.classId,
              className: pair.className,
              sectionId: pair.sectionId,
              sectionName: pair.sectionName,
              academicYearId: this.selectedAcademicYearId,
            });
          });
          completed++;
          if (completed === pairs.length) this.finishAllClassesLoad(aggregated);
        },
        error: () => {
          completed++;
          if (completed === pairs.length) this.finishAllClassesLoad(aggregated);
        },
      });
    });
  }

  private finishAllClassesLoad(periods: TimetablePeriod[]): void {
    periods.sort((a, b) => {
      if (a.periodNumber !== b.periodNumber) return a.periodNumber - b.periodNumber;
      const aLabel = `${a.className || ''} ${a.sectionName || ''}`.trim();
      const bLabel = `${b.className || ''} ${b.sectionName || ''}`.trim();
      return aLabel.localeCompare(bLabel);
    });
    this.timetablePeriods = periods;
    this.isLoadingPeriods = false;
  }

  onSectionOrDateChange(): void {
    this.selectedPeriod = null;
    this.students = [];
    this.studentsLoaded = false;
    this.isHoliday = false;
    this.holidayTitle = '';
    this.isAlreadyMarked = false;

    // "All Classes" path — no section filter, just aggregate across everything.
    if (this.selectedClassId === 'ALL') {
      this.loadPeriodsForAllClasses();
      return;
    }
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
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    const sec = (cls?.sections || []).find((s: any) => s.sectionId === this.selectedSectionId) as any;
    const className = cls?.name;
    const sectionName = sec?.name;

    this.api.getTimetablePeriods(this.selectedClassId, this.selectedSectionId, dateStr, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        // Backend doesn't stamp class/section on period data — do it here so
        // the cards can display them uniformly across all dropdown modes.
        let data = (res.data || []);
        // In teacher mode, only show periods this teacher actually teaches.
        // The backend returns every period for the class+section; we filter
        // client-side so other teachers' periods (e.g. Hindi) never appear.
        if (this.isTeacherMode && this.teacherUserId) {
          data = data.filter((p: any) => p.teacherId === this.teacherUserId);
        }
        this.timetablePeriods = data.map((p: any) => ({
          ...p,
          classId: this.selectedClassId,
          sectionId: this.selectedSectionId,
          className,
          sectionName,
          academicYearId: this.selectedAcademicYearId,
        }));
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
    // In teacher-mode auto-load, the period carries its own class/section/year.
    // Copy those onto the component state so saveAttendance() + loadStudents() work unchanged.
    if (period.classId) this.selectedClassId = period.classId;
    if (period.sectionId) this.selectedSectionId = period.sectionId;
    if (period.academicYearId) this.selectedAcademicYearId = period.academicYearId;
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
    this.isAlreadyMarked = false;
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
        // After students load, overlay any previously-saved statuses.
        this.overlayExistingMarks();
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load students', 'Close', { duration: 3000 });
      },
    });
  }

  /**
   * If attendance has already been saved for the selected (class, section, date,
   * periodNumber, subjectId), replace the default PRESENT values with the
   * saved statuses and flag the UI as "editing an already-marked record".
   */
  private overlayExistingMarks(): void {
    if (!this.selectedPeriod || !this.selectedClassId || !this.selectedSectionId) {
      this.isLoading = false;
      return;
    }
    const dateStr = this.getDateStr();
    this.api.getBatchAttendance(this.selectedClassId, this.selectedSectionId, dateStr).subscribe({
      next: (res) => {
        const records = res?.data || [];
        const p = this.selectedPeriod!;
        const match = records.find((r: any) =>
          r.periodNumber === p.periodNumber
          && (!r.subjectId || !p.subjectId || r.subjectId === p.subjectId));
        if (match && Array.isArray(match.entries) && match.entries.length > 0) {
          const byId: Record<string, any> = {};
          match.entries.forEach((e: any) => { byId[e.studentId] = e; });
          this.students = this.students.map(s => {
            const existing = byId[s.studentId];
            if (!existing) return s;
            return {
              ...s,
              status: (existing.status as 'PRESENT' | 'ABSENT' | 'LATE') || s.status,
              remarks: existing.remarks || s.remarks || '',
            };
          });
          this.isAlreadyMarked = true;
        } else {
          this.isAlreadyMarked = false;
        }
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
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
        // Refresh period state. Teacher auto-load cards are kept in memory;
        // admin/fallback flow reloads the server-side day view.
        if (this.isTeacherMode && !this.showFilters) {
          this.applyTeacherDayFilter();
        } else {
          this.loadTimetablePeriods();
        }
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
