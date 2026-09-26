import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AcademicYear, SchoolClass, WeekDay } from '../../../core/models';

interface AbsentStudentRef {
  studentId: string;
  fullName: string;
  rollNumber?: string;
}

interface DayStatusRow {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  studentCount: number;
  status: 'MARKED' | 'NOT_MARKED';
  markedAt?: string;
  presentCount: number;
  absentCount: number;
  otherCount: number;
  /** Names of students marked ABSENT — empty when status is NOT_MARKED
   *  or when nobody was absent. Drives the under-counts line on the
   *  Marked card so admins see who's missing at a glance. */
  absentees?: AbsentStudentRef[];
}

/**
 * Day-wise attendance hub. The side nav drops the admin here so they
 * can see, at a glance, which (class, section) pairs still need
 * roll-call today and which are already done. Each card click opens
 * the per-class mark form prefilled with the right (class, section,
 * date) so they never touch the dropdown trio.
 */
@Component({
  selector: 'app-view-attendance',
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
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './view-attendance.component.html',
  styleUrl: './view-attendance.component.scss',
  providers: [provideNativeDateAdapter()],
})
export class ViewAttendanceComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  selectedDate: Date = new Date();
  today: Date = new Date();

  rows: DayStatusRow[] = [];
  isLoading = false;

  /** Filter the card grid by class name. 'ALL' shows every class. */
  classFilter: string = 'ALL';

  /** classId → weekly off-days lookup. Filled once from the Classes API
   *  and refreshed only when the tenant reloads the page. Used to hide
   *  class cards on their configured weekly off days (LKG/UKG on
   *  Saturday, etc.) so admins don't get prompted to mark attendance
   *  for a class that isn't in session. */
  private classOffDays = new Map<string, Set<WeekDay>>();

  /** Class names hidden by the weekly-off filter on the selected date.
   *  Rendered as a small info line above the tabs so the admin
   *  understands why some sections are missing. */
  hiddenOffClassNames: string[] = [];

  /** Card keys ({classId}::{sectionId}) whose absentee list is expanded.
   *  Cards with the list collapsed show only the count header — keeps the
   *  grid tidy when a section has 15+ absentees. */
  private expandedAbsentees = new Set<string>();

  /** Above this absentee count we fold the list behind a toggle; at or
   *  below, the chips render inline. 4 keeps the card height bounded
   *  while still giving small-absentee sections a glanceable list. */
  readonly absenteeAccordionThreshold = 4;

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // Pre-fetch classes so we know each class's weekly off-days before
    // the first day-status render. Fire-and-forget: if it errors we
    // just fall back to no filtering (existing behaviour).
    this.loadClassOffDays();

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = Array.isArray(res.data) ? res.data : (res.data as any)?.content || [];
        const current = this.academicYears.find((y) => y.current);
        this.selectedAcademicYearId = current ? current.academicYearId : (this.academicYears[0]?.academicYearId || '');
        this.reload();
      },
      error: () => {
        this.academicYears = [];
      },
    });
  }

  private loadClassOffDays(): void {
    this.api.getClasses().subscribe({
      next: (res) => {
        const list: SchoolClass[] = Array.isArray(res.data)
          ? res.data
          : ((res.data as any)?.content || []);
        this.classOffDays.clear();
        for (const cls of list) {
          if (!cls.classId) continue;
          const set = new Set<WeekDay>();
          for (const d of (cls.weeklyOffDays || [])) set.add(d);
          this.classOffDays.set(cls.classId, set);
        }
        // Recompute the hidden-list against whatever rows are already
        // on screen so a late-arriving classes response still updates
        // the info line without waiting for the next reload().
        this.rebuildHiddenClassNames();
      },
      error: () => {
        this.classOffDays.clear();
      },
    });
  }

  /** Java DayOfWeek names — matches the backend enum stored on
   *  SchoolClass.weeklyOffDays. JS Date.getDay() is 0=Sun..6=Sat. */
  private readonly WEEKDAY_NAMES: WeekDay[] = [
    'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
    'THURSDAY', 'FRIDAY', 'SATURDAY',
  ];

  private selectedDayOfWeek(): WeekDay {
    return this.WEEKDAY_NAMES[this.selectedDate.getDay()];
  }

  /** True when the selected date falls on this class's weekly off day. */
  private isClassOffToday(classId: string): boolean {
    const set = this.classOffDays.get(classId);
    if (!set || set.size === 0) return false;
    return set.has(this.selectedDayOfWeek());
  }

  private rebuildHiddenClassNames(): void {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const r of this.rows) {
      if (!this.isClassOffToday(r.classId)) continue;
      if (seen.has(r.className)) continue;
      seen.add(r.className);
      names.push(r.className);
    }
    this.hiddenOffClassNames = names;
  }

  onAcademicYearChange(): void { this.reload(); }
  onDateChange(): void { this.reload(); }

  reload(): void {
    if (!this.selectedAcademicYearId || !this.selectedDate) {
      this.rows = [];
      return;
    }
    this.isLoading = true;
    const dateStr = this.formatDate(this.selectedDate);
    this.api.getAttendanceDayStatus(this.selectedAcademicYearId, dateStr).subscribe({
      next: (res) => {
        this.rows = Array.isArray(res.data) ? res.data : [];
        this.rebuildHiddenClassNames();
        this.isLoading = false;
      },
      error: (err) => {
        this.rows = [];
        this.hiddenOffClassNames = [];
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to load attendance status', 'Close', { duration: 3000 });
      },
    });
  }

  /** Distinct class names in the result — drives the class-filter chips. */
  get classNameOptions(): string[] {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.className) set.add(r.className);
    }
    return Array.from(set);
  }

  get filteredRows(): DayStatusRow[] {
    // Weekly-off hide first — a class not in session today is out of
    // scope for BOTH tabs. Class-name chip filter runs on top of that
    // as a normal drill-down.
    const base = this.rows.filter(r => !this.isClassOffToday(r.classId));
    if (this.classFilter === 'ALL') return base;
    return base.filter(r => r.className === this.classFilter);
  }

  get todoRows(): DayStatusRow[] {
    return this.filteredRows.filter(r => r.status === 'NOT_MARKED');
  }

  get doneRows(): DayStatusRow[] {
    return this.filteredRows.filter(r => r.status === 'MARKED');
  }

  openMarkAttendance(row: DayStatusRow): void {
    // Drop into the existing detail form with everything pre-selected so
    // the admin lands on the student grid in one click — no dropdown
    // round-trip. Date is forwarded as a query param so backdated sessions
    // also wire through.
    const dateStr = this.formatDate(this.selectedDate);
    this.router.navigate(
      ['/attendance/mark'],
      { queryParams: { classId: row.classId, sectionId: row.sectionId, date: dateStr } }
    );
  }

  /** Compact "Roll - Name" labels for absentees on the Marked card.
   *  Falls back to bare name when no roll number is set. */
  absenteeLabel(a: AbsentStudentRef): string {
    if (a.rollNumber) return `${a.rollNumber} · ${a.fullName}`;
    return a.fullName;
  }

  /** Students in the roster who have NO saved attendance record —
   *  computed as roster size minus everyone the backend counted.
   *  Surfaces cases where biometric marked a handful of kids but
   *  the teacher hasn't finished the roll-call yet. */
  unmarkedCount(row: DayStatusRow): number {
    const accountedFor = (row.presentCount || 0)
                       + (row.absentCount || 0)
                       + (row.otherCount || 0);
    return Math.max(0, (row.studentCount || 0) - accountedFor);
  }

  /** True when this card has enough absentees that the list folds
   *  behind a toggle. Below the threshold the chips render inline. */
  shouldCollapseAbsentees(row: DayStatusRow): boolean {
    return (row.absentees?.length || 0) > this.absenteeAccordionThreshold;
  }

  /** True when the admin has expanded this card's absentee list. */
  isAbsenteeListExpanded(row: DayStatusRow): boolean {
    return this.expandedAbsentees.has(this.absenteeKey(row));
  }

  /** Toggle the absentee list open/closed on a card. Stops the event
   *  propagating up so the card's own click handler (open Mark
   *  Attendance form) doesn't fire from the same gesture. */
  toggleAbsenteeList(row: DayStatusRow, event: Event): void {
    event.stopPropagation();
    const key = this.absenteeKey(row);
    if (this.expandedAbsentees.has(key)) this.expandedAbsentees.delete(key);
    else this.expandedAbsentees.add(key);
  }

  private absenteeKey(row: DayStatusRow): string {
    return `${row.classId}::${row.sectionId}`;
  }

  /** Friendly "9:12 AM" timestamp for the marked-at tooltip on Done cards. */
  formatMarkedTime(iso: string | undefined): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
