import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { AcademicYear, Timetable, TimetablePeriod } from '../../../core/models';

interface GridPeriod extends TimetablePeriod {
  className?: string;
  sectionName?: string;
  classId?: string;
  sectionId?: string;
  colorIndex?: number;
  isNow?: boolean;
}

interface DayColumn {
  dayOfWeek: string;
  shortLabel: string;
  periods: GridPeriod[];
  isToday: boolean;
  holidayTitle?: string;
  date: Date;
}

interface Holiday {
  startDate: string;
  endDate?: string;
  title: string;
}

@Component({
  selector: 'app-teacher-timetable',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './teacher-timetable.component.html',
  styleUrl: './teacher-timetable.component.scss',
})
export class TeacherTimetableComponent implements OnInit {
  readonly DAYS: { key: string; short: string }[] = [
    { key: 'MONDAY', short: 'Mon' },
    { key: 'TUESDAY', short: 'Tue' },
    { key: 'WEDNESDAY', short: 'Wed' },
    { key: 'THURSDAY', short: 'Thu' },
    { key: 'FRIDAY', short: 'Fri' },
    { key: 'SATURDAY', short: 'Sat' },
  ];

  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';

  timetables: Timetable[] = [];
  days: DayColumn[] = [];
  periodNumbers: number[] = [];
  totalPeriodsPerWeek = 0;
  uniqueSubjects = 0;
  uniqueClasses = 0;

  isLoading = false;
  teacherId = '';
  teacherName = '';

  private classNameMap: Record<string, string> = {};
  private sectionNameMap: Record<string, string> = {};
  private holidays: Holiday[] = [];
  todayHolidayTitle = '';
  weekHolidayCount = 0;

  private subjectColorMap: Record<string, number> = {};
  private colorPaletteSize = 8;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    this.teacherId = user?.userId || '';
    this.teacherName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

    if (!this.teacherId) {
      this.snackBar.open('Please sign in again to view your timetable', 'Close', { duration: 3000 });
      return;
    }

    this.loadClassNames();
    this.loadHolidays();
    this.loadAcademicYears();
  }

  private loadHolidays(): void {
    this.api.getHolidays().subscribe({
      next: (res) => {
        this.holidays = (res?.data || []).map((h: any) => ({
          startDate: h.startDate,
          endDate: h.endDate || h.startDate,
          title: h.title || 'Holiday',
        }));
        if (this.timetables.length > 0 || this.days.length > 0) this.buildGrid();
      },
      error: () => {
        this.holidays = [];
      },
    });
  }

  private holidayForDate(date: Date): Holiday | null {
    const dStr = this.toIsoDate(date);
    for (const h of this.holidays) {
      if (!h.startDate) continue;
      const start = h.startDate;
      const end = h.endDate || h.startDate;
      if (dStr >= start && dStr <= end) return h;
    }
    return null;
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private weekDateFor(dayKey: string): Date {
    // Find the date this week (Sun..Sat) that matches `dayKey`
    const today = new Date();
    const todayIdx = today.getDay(); // 0=Sun
    const keyIdx = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'].indexOf(dayKey);
    const delta = keyIdx - todayIdx;
    const d = new Date(today);
    d.setDate(today.getDate() + delta);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private loadClassNames(): void {
    this.api.getClasses().subscribe({
      next: (res) => {
        const classes = Array.isArray(res.data) ? res.data : [];
        classes.forEach((c: any) => {
          if (c?.classId) this.classNameMap[c.classId] = c.name || c.classId;
          (c?.sections || []).forEach((s: any) => {
            if (s?.sectionId) this.sectionNameMap[s.sectionId] = s.name || s.sectionId;
          });
        });
        // If timetables already arrived, re-render with resolved names
        if (this.timetables.length > 0) this.buildGrid();
      },
    });
  }

  loadAcademicYears(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = res.data || [];
        const current = this.academicYears.find((y) => y.current);
        if (current) {
          this.selectedAcademicYearId = current.academicYearId;
          this.loadSchedule();
        } else if (this.academicYears.length > 0) {
          this.selectedAcademicYearId = this.academicYears[0].academicYearId;
          this.loadSchedule();
        }
      },
    });
  }

  onAcademicYearChange(): void {
    if (this.selectedAcademicYearId) {
      this.loadSchedule();
    } else {
      this.days = [];
      this.periodNumbers = [];
      this.totalPeriodsPerWeek = 0;
    }
  }

  loadSchedule(): void {
    if (!this.teacherId || !this.selectedAcademicYearId) return;
    this.isLoading = true;

    this.api.getTeacherTimetable(this.teacherId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.timetables = res.data || [];
        this.buildGrid();
        this.isLoading = false;
      },
      error: () => {
        this.timetables = [];
        this.buildGrid();
        this.isLoading = false;
        this.snackBar.open('Failed to load your timetable', 'Close', { duration: 3000 });
      },
    });
  }

  private buildGrid(): void {
    const todayKey = this.getTodayKey();
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Reset counters
    this.subjectColorMap = {};
    const subjectSet = new Set<string>();
    const classSet = new Set<string>();
    const periodSet = new Set<number>();
    let total = 0;

    let holidayCount = 0;
    this.todayHolidayTitle = '';

    // Flatten: for each day in DAYS, collect this teacher's periods across all returned timetables
    this.days = this.DAYS.map(({ key, short }) => {
      const dayDate = this.weekDateFor(key);
      const hol = this.holidayForDate(dayDate);
      const periods: GridPeriod[] = [];

      for (const tt of this.timetables) {
        const daySched = (tt.schedule || []).find((d: any) => (d.dayOfWeek || '').toUpperCase() === key);
        if (!daySched || !daySched.periods) continue;

        for (const p of daySched.periods) {
          if (p.teacherId !== this.teacherId) continue;

          const gp: GridPeriod = {
            ...p,
            className: tt.className || this.classNameMap[tt.classId] || tt.classId,
            sectionName: tt.sectionName || this.sectionNameMap[tt.sectionId] || tt.sectionId,
            classId: tt.classId,
            sectionId: tt.sectionId,
            colorIndex: this.colorFor(p.subjectId || p.subjectName || ''),
            isNow: !hol && key === todayKey && this.isPeriodNow(p, currentMin),
          };
          periods.push(gp);

          // Only count periods that actually happen (not on holidays)
          if (!hol) {
            subjectSet.add(p.subjectId || p.subjectName || '');
            if (tt.classId) classSet.add(`${tt.classId}:${tt.sectionId}`);
            periodSet.add(p.periodNumber);
            total++;
          }
        }
      }

      periods.sort((a, b) => a.periodNumber - b.periodNumber);

      if (hol) {
        holidayCount++;
        if (key === todayKey) this.todayHolidayTitle = hol.title;
      }

      return {
        dayOfWeek: key,
        shortLabel: short,
        periods,
        isToday: key === todayKey,
        holidayTitle: hol?.title,
        date: dayDate,
      };
    });

    this.weekHolidayCount = holidayCount;

    this.periodNumbers = Array.from(periodSet).sort((a, b) => a - b);
    this.totalPeriodsPerWeek = total;
    this.uniqueSubjects = subjectSet.size;
    this.uniqueClasses = classSet.size;
  }

  getPeriodForCell(day: DayColumn, periodNumber: number): GridPeriod | null {
    return day.periods.find((p) => p.periodNumber === periodNumber) || null;
  }

  hasAnyPeriods(): boolean {
    return this.totalPeriodsPerWeek > 0;
  }

  private getTodayKey(): string {
    const idx = new Date().getDay(); // 0=Sun
    const map = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return map[idx];
  }

  private isPeriodNow(p: TimetablePeriod, currentMin: number): boolean {
    if (!p.startTime || !p.endTime) return false;
    const [sh, sm] = p.startTime.split(':').map(Number);
    const [eh, em] = p.endTime.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return currentMin >= start && currentMin < end;
  }

  private colorFor(key: string): number {
    if (!this.subjectColorMap[key] && this.subjectColorMap[key] !== 0) {
      this.subjectColorMap[key] = Object.keys(this.subjectColorMap).length % this.colorPaletteSize;
    }
    return this.subjectColorMap[key];
  }
}
