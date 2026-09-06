import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  EmployeeAttendance, PublicAttendanceSettings, RegularizationRequest, User,
} from '../../../../core/models';
import { RegularizationDialogComponent } from './regularization-dialog/regularization-dialog.component';
import { DayDetailsDialogComponent } from './day-details-dialog/day-details-dialog.component';

/**
 * One cell in the calendar grid — a specific date with the
 * attendance status attached (if any). Undefined status means the
 * date is either in the future, or the employee had no row on that
 * day (which for a past working day means ABSENT if the auto-absent
 * job has run; for a weekend it's WEEK_OFF).
 */
interface CalendarCell {
  date: Date;
  /** yyyy-MM-dd — used as the map key against attendance rows. */
  iso: string;
  dayOfMonth: number;
  /** Days from a neighbouring month rendered greyed-out at the
   *  start/end of the grid so the row layout stays consistent. */
  inCurrentMonth: boolean;
  /** Sunday (0) OR the tenant's configured week-off day. Renders
   *  in a subtle grey with no fill. */
  isWeekOff: boolean;
  /** Tenant-declared holiday — rendered in a blue tint, distinct
   *  from Sunday's grey, and carries the holiday name in the
   *  tooltip. Loaded from /hr/attendance/holidays. */
  isHoliday: boolean;
  /** Human-readable holiday title (e.g. "Diwali"). Empty when the
   *  cell isn't a holiday, or when the event carried no title. */
  holidayName?: string;
  isToday: boolean;
  isFuture: boolean;
  status?: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
  late?: boolean;
  /** Where the row came from. LOCATION / BIOMETRIC = real punch,
   *  MANUAL = HR filled it in, REGULARIZATION = a request was
   *  approved. Drives a small indicator dot on the calendar cell
   *  so employees can tell "which of my present days came from
   *  a real punch vs a regularization". */
  source?: 'LOCATION' | 'BIOMETRIC' | 'MANUAL' | 'REGULARIZATION';
  /** Status of any regularization request submitted for this day
   *  (pending/rejected requests don't produce an attendance row,
   *  so we surface them via a corner-dot indicator on the cell —
   *  employee sees at a glance which of their submissions HR
   *  hasn't acted on yet). Absent when the employee never asked
   *  for that day. */
  regRequestStatus?: 'PENDING' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED';
}

/**
 * Employee "My Attendance" — calendar redesign.
 *
 * <p>Two tabs:</p>
 * <ul>
 *   <li><b>Attendance</b> — month picker + summary stats card +
 *       colored day-circle calendar + legend. The primary lens on
 *       "did I show up?" data.</li>
 *   <li><b>Regularization</b> — the existing request card + recent
 *       requests list, tucked behind a tab so it doesn't compete
 *       for space with the calendar in the default view.</li>
 * </ul>
 *
 * <p>Calendar month can be navigated back with prev/next arrows.
 * Loading is scoped per-month — every month change re-fetches with
 * an explicit {@code from} / {@code to} on {@code hrMyAttendance}
 * so a scroll to July doesn't need us to hold the whole year.</p>
 */
@Component({
  selector: 'app-my-attendance',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatTableModule, MatTooltipModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  providers: [DatePipe],
  templateUrl: './my-attendance.component.html',
  styleUrl: './my-attendance.component.scss',
})
export class MyAttendanceComponent implements OnInit, OnDestroy {

  settings: PublicAttendanceSettings | null = null;
  rows: EmployeeAttendance[] = [];
  today: EmployeeAttendance | null = null;
  myRequests: RegularizationRequest[] = [];
  currentUser: User | null = null;

  /** Declared holidays overlapping the current view month. Keyed
   *  by yyyy-MM-dd for O(1) lookup during calendar cell build.
   *  Refreshed alongside `loadMonth()` whenever the range changes. */
  holidayNameByDate = new Map<string, string>();

  isLoadingSettings = false;
  isLoadingRows = false;

  /** Which internal tab is showing — 'attendance' (calendar) or
   *  'regularization' (request form + history). Segmented pill
   *  UI matches the mobile reference the user asked for. */
  activeTab: 'attendance' | 'regularization' = 'attendance';

  /** Anchor for the month currently shown in the calendar. Always
   *  the 1st of the month for consistency; setters below shift it
   *  by whole months when the user hits < / >. */
  viewMonth: Date = this.firstOfMonth(new Date());

  /** Cached grid so the template doesn't rebuild it on every tick
   *  of the workday stopwatch. Invalidated when the month changes
   *  or when new rows arrive. */
  calendar: CalendarCell[] = [];

  /** Live "time on work" ticker — seconds elapsed between IN and
   *  either OUT (frozen) or now (running). */
  elapsedSeconds = 0;
  private tickerId?: ReturnType<typeof setInterval>;

  todayIso = this.formatDateLocal(new Date());

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
    private router: Router,
    private auth: AuthService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.loadSettings();
    this.loadMonth();
    this.loadMyRequests();
  }

  ngOnDestroy(): void {
    this.stopTicker();
  }

  // ── Data loads ────────────────────────────────

  private loadSettings(): void {
    this.isLoadingSettings = true;
    this.api.hrPublicSettings().subscribe({
      next: (res) => {
        this.settings = res.data;
        this.isLoadingSettings = false;
        this.rebuildCalendar();  // week-off day depends on settings
      },
      error: () => { this.isLoadingSettings = false; },
    });
  }

  private loadMonth(): void {
    this.isLoadingRows = true;
    const from = this.formatDateLocal(this.viewMonth);
    const to = this.formatDateLocal(this.lastOfMonth(this.viewMonth));
    this.api.hrMyAttendance(from, to).subscribe({
      next: (res) => {
        this.rows = (res.data || []).sort((a, b) => (a.date < b.date ? 1 : -1));
        this.today = this.rows.find(r => r.date === this.todayIso) || null;
        this.isLoadingRows = false;
        this.rebuildCalendar();
        this.recomputeElapsed();
        this.restartTickerIfNeeded();
      },
      error: () => { this.rows = []; this.today = null; this.isLoadingRows = false; this.rebuildCalendar(); },
    });
    // Parallel holiday fetch — silent-fail so the calendar still
    // renders (with just Sunday week-offs) if the endpoint isn't
    // reachable (feature flag off, older backend, etc).
    this.loadHolidays(from, to);
  }

  private loadHolidays(from: string, to: string): void {
    this.api.hrHolidays(from, to).subscribe({
      next: (res) => {
        this.holidayNameByDate = new Map<string, string>();
        const dates = res?.data?.holidayDates || [];
        const names = res?.data?.holidayNames || [];
        dates.forEach((d, i) => this.holidayNameByDate.set(d, names[i] || ''));
        this.rebuildCalendar();
      },
      error: () => { this.holidayNameByDate = new Map(); this.rebuildCalendar(); },
    });
  }

  private loadMyRequests(): void {
    this.api.hrMyRegularizations().subscribe({
      next: (res) => {
        this.myRequests = res.data || [];
        // Rebuild so pending/rejected request corner-dots appear
        // without waiting for a month change.
        this.rebuildCalendar();
      },
      error: () => (this.myRequests = []),
    });
  }

  // ── Month navigation ─────────────────────────

  prevMonth(): void {
    const d = new Date(this.viewMonth);
    d.setMonth(d.getMonth() - 1);
    this.viewMonth = this.firstOfMonth(d);
    this.loadMonth();
  }

  nextMonth(): void {
    const d = new Date(this.viewMonth);
    d.setMonth(d.getMonth() + 1);
    this.viewMonth = this.firstOfMonth(d);
    this.loadMonth();
  }

  /** Disable "next" once we're on the current month — no future
   *  attendance to look at. */
  get canGoNext(): boolean {
    const now = this.firstOfMonth(new Date());
    return this.viewMonth < now;
  }

  get monthLabel(): string {
    return this.viewMonth.toLocaleDateString('en-IN',
      { month: 'long', year: 'numeric' });
  }

  // ── Calendar grid ────────────────────────────

  /**
   * Rebuild the 6-row × 7-col calendar grid for the view month.
   * Fills in surrounding-month days at the top / bottom rows so
   * the grid always has the same shape (avoids jumpy layout when
   * month lengths change).
   */
  private rebuildCalendar(): void {
    const cells: CalendarCell[] = [];
    const first = this.firstOfMonth(this.viewMonth);
    const last = this.lastOfMonth(this.viewMonth);
    // Sunday = 0 in JS. Grid starts on Sunday to match the mobile
    // reference (Sun-Sat header).
    const leadingBlank = first.getDay();
    const totalDays = last.getDate();
    const rowsById = new Map<string, EmployeeAttendance>();
    for (const r of this.rows) rowsById.set(r.date, r);
    // Index regularization requests by date too — pending / rejected
    // requests don't produce an attendance row, so the calendar
    // needs its own lookup to surface them via a corner indicator.
    const reqsById = new Map<string, string>();
    for (const r of this.myRequests) {
      // Keep the most-serious status if there's ever more than one
      // request for a date (should be prevented on the backend, but
      // defensive — approved wins over pending, pending over rejected).
      const priority: { [k: string]: number } = {
        APPROVED: 3, AUTO_APPROVED: 3, PENDING: 2, REJECTED: 1,
      };
      const existing = reqsById.get(r.date);
      if (!existing || (priority[r.status] || 0) > (priority[existing] || 0)) {
        reqsById.set(r.date, r.status);
      }
    }

    // Leading days from previous month
    for (let i = leadingBlank - 1; i >= 0; i--) {
      const d = new Date(first);
      d.setDate(-i);
      cells.push(this.makeCell(d, false, undefined, undefined));
    }
    // Current month
    for (let dom = 1; dom <= totalDays; dom++) {
      const d = new Date(first);
      d.setDate(dom);
      const iso = this.formatDateLocal(d);
      cells.push(this.makeCell(d, true, rowsById.get(iso), reqsById.get(iso)));
    }
    // Trailing to fill 6 weeks (42 cells) — keeps layout stable
    while (cells.length < 42) {
      const d = new Date(last);
      d.setDate(last.getDate() + (cells.length - (leadingBlank + totalDays - 1)));
      cells.push(this.makeCell(d, false, undefined, undefined));
    }
    this.calendar = cells;
    this.cdr.markForCheck();
  }

  private makeCell(d: Date, inCurrentMonth: boolean,
                    row?: EmployeeAttendance,
                    regStatus?: string): CalendarCell {
    const iso = this.formatDateLocal(d);
    const todayIso = this.todayIso;
    // Week-off = Sunday for now. Future work: read the tenant's
    // configured week-off day(s) from settings when we add that.
    const isWeekOff = d.getDay() === 0;
    const isHoliday = this.holidayNameByDate.has(iso);
    return {
      date: d,
      iso,
      dayOfMonth: d.getDate(),
      inCurrentMonth,
      isWeekOff,
      isHoliday,
      holidayName: isHoliday ? this.holidayNameByDate.get(iso) : undefined,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
      status: row?.status as CalendarCell['status'],
      late: row?.late,
      source: row?.source as CalendarCell['source'],
      regRequestStatus: regStatus as CalendarCell['regRequestStatus'],
    };
  }

  /** Class per cell — drives the color-coded circles. Kept as a
   *  method (not template piping) so the logic is testable.
   *
   *  <p>Every value is coerced with {@code !!} so TS strict mode
   *  accepts them as pure booleans (CalendarCell.late is optional
   *  → boolean | undefined which the class-binding signature
   *  rejects otherwise).</p> */
  cellClass(c: CalendarCell): { [k: string]: boolean } {
    const isLate = !!c.late;
    // A future Sunday is still a week-off — we want the pale week-off
    // background to show (not the transparent "future" look), so
    // `--future` is skipped when `--weekoff` also applies. Keeps
    // Sundays across the whole month reading as one consistent
    // group instead of only the past ones getting the pale fill.
    // Same reasoning for holidays — a future holiday should show the
    // holiday tint (blue), not the transparent "future" look.
    const isFutureNonOff = c.isFuture && c.inCurrentMonth && !c.status && !c.isWeekOff && !c.isHoliday;
    return {
      'cal-cell': true,
      'cal-cell--other':   !c.inCurrentMonth,
      // Holiday wins over week-off when both hit (e.g. a Sunday
      // that's also declared a holiday) — the blue tint carries more
      // information (Diwali, Republic Day, etc) than the plain grey.
      'cal-cell--holiday': c.inCurrentMonth && c.isHoliday && !c.status,
      'cal-cell--weekoff': c.inCurrentMonth && c.isWeekOff && !c.status && !c.isHoliday,
      'cal-cell--today':   c.isToday && c.inCurrentMonth,
      'cal-cell--future':  isFutureNonOff,
      'cal-cell--present': !!c.status && (c.status === 'PRESENT' || c.status === 'LATE') && !isLate,
      'cal-cell--late':    !!c.status && isLate,
      'cal-cell--halfday': c.status === 'HALF_DAY',
      'cal-cell--absent':  c.status === 'ABSENT',
      // Corner-dot markers — mutually distinguishable colors so
      // employees can tell one from another at a glance:
      //   blue  = approved regularization / HR manual entry
      //   amber = pending regularization (HR hasn't reviewed yet)
      //   red   = rejected regularization (informational — no
      //           attendance row, HR turned it down)
      'cal-cell--regularized':  c.source === 'REGULARIZATION'
                             || c.regRequestStatus === 'APPROVED'
                             || c.regRequestStatus === 'AUTO_APPROVED',
      'cal-cell--manual':       c.source === 'MANUAL',
      'cal-cell--reg-pending':  c.regRequestStatus === 'PENDING',
      'cal-cell--reg-rejected': c.regRequestStatus === 'REJECTED',
    };
  }

  /** Human-readable tooltip for a cell — extends the status with a
   *  source hint when it's not a plain punch, and surfaces any
   *  pending / rejected regularization for the day. */
  cellTooltip(c: CalendarCell): string {
    if (!c.inCurrentMonth) return '';
    const bits: string[] = [];
    if (c.status) bits.push(c.status);
    if (c.late) bits.push('Late');
    if (c.source === 'REGULARIZATION') bits.push('Regularized');
    else if (c.source === 'MANUAL') bits.push('HR-marked');
    if (c.regRequestStatus === 'PENDING') bits.push('Regularization pending');
    else if (c.regRequestStatus === 'REJECTED') bits.push('Regularization rejected');
    if (c.isHoliday && !c.status) {
      bits.push('Holiday' + (c.holidayName ? ` — ${c.holidayName}` : ''));
    }
    return bits.join(' · ');
  }

  // ── Monthly summary counters ────────────────

  get summary(): {
    present: number; late: number; halfDay: number; absent: number;
    weekOff: number; totalWorkDays: number;
  } {
    const acc = { present: 0, late: 0, halfDay: 0, absent: 0, weekOff: 0, totalWorkDays: 0 };
    for (const c of this.calendar) {
      if (!c.inCurrentMonth) continue;
      if (c.isWeekOff && !c.status) { acc.weekOff++; continue; }
      // Count all "possible working days" of the month for the
      // ratio ("18 / 22 present" style copy). Future days are
      // excluded so a fresh month doesn't read as 0/30.
      if (!c.isFuture) acc.totalWorkDays++;
      if (c.status === 'PRESENT' || c.status === 'LATE') acc.present++;
      if (c.late) acc.late++;
      if (c.status === 'HALF_DAY') acc.halfDay++;
      if (c.status === 'ABSENT') acc.absent++;
    }
    return acc;
  }

  // ── Live ticker (unchanged) ──────────────────

  private recomputeElapsed(): void {
    if (!this.today?.inTime) { this.elapsedSeconds = 0; return; }
    const inMs = new Date(this.today.inTime).getTime();
    const endMs = this.today.outTime
      ? new Date(this.today.outTime).getTime()
      : Date.now();
    this.elapsedSeconds = Math.max(0, Math.floor((endMs - inMs) / 1000));
  }

  private restartTickerIfNeeded(): void {
    this.stopTicker();
    if (!this.today?.inTime || this.today.outTime) return;
    this.zone.runOutsideAngular(() => {
      this.tickerId = setInterval(() => {
        this.elapsedSeconds++;
        this.cdr.markForCheck();
      }, 1000);
    });
  }

  private stopTicker(): void {
    if (this.tickerId) { clearInterval(this.tickerId); this.tickerId = undefined; }
  }

  get elapsedFormatted(): string {
    const s = this.elapsedSeconds;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${h}h ${pad(m)}m ${pad(sec)}s`;
    return `${pad(m)}m ${pad(sec)}s`;
  }

  get isWorkRunning(): boolean {
    return !!(this.today?.inTime && !this.today.outTime);
  }

  // ── Actions ─────────────────────────────────

  /** Click on any calendar cell — opens the day details popup with
   *  the attendance row (if any) + the regularization request
   *  (if any). Skipped for other-month days to keep the grid
   *  edges non-interactive. */
  openDayDetails(c: CalendarCell): void {
    if (!c.inCurrentMonth) return;
    const row = this.rows.find(r => r.date === c.iso);
    const request = this.myRequests.find(r => r.date === c.iso);
    this.dialog.open(DayDetailsDialogComponent, {
      data: {
        dateIso: c.iso,
        row,
        request,
        isWeekOff: c.isWeekOff,
        isHoliday: c.isHoliday,
        holidayName: c.holidayName,
        isFuture: c.isFuture,
      },
      autoFocus: false,
      panelClass: 'day-details-panel',
      width: '100vw',
      maxWidth: '100vw',
    });
  }

  goToMarkPage(): void {
    if (!this.settings?.locationBasedEnabled) {
      this.snack.open(
        'Location marking isn\'t enabled by your school. Ask HR.',
        'Close', { duration: 4000 });
      return;
    }
    this.router.navigate(['/hr/attendance/mark']);
  }

  openRegularizationDialog(): void {
    if (!this.settings?.regularizationEnabled) {
      this.snack.open(
        'Regularization requests are turned off. Ask HR to enable them in Attendance Settings.',
        'Close', { duration: 4500 });
      return;
    }
    const ref = this.dialog.open(RegularizationDialogComponent, {
      autoFocus: false,
      panelClass: 'regularization-dialog-panel',
      width: '100vw',
      maxWidth: '100vw',
    });
    ref.afterClosed().subscribe((submitted) => {
      if (submitted) {
        this.loadMonth();
        this.loadMyRequests();
      }
    });
  }

  requestStatusClass(status: string): string {
    switch (status) {
      case 'PENDING':        return 'chip-pending';
      case 'AUTO_APPROVED':  return 'chip-approved';
      case 'APPROVED':       return 'chip-approved';
      case 'REJECTED':       return 'chip-rejected';
      default:               return '';
    }
  }

  requestStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING':        return 'Pending';
      case 'AUTO_APPROVED':  return 'Auto-approved';
      case 'APPROVED':       return 'Approved';
      case 'REJECTED':       return 'Rejected';
      default:               return status;
    }
  }

  // ── Hero computed props (unchanged) ─────────

  get welcomeName(): string {
    const u = this.currentUser;
    if (!u) return '';
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return full || u.username || 'there';
  }

  get workStatusLine(): string {
    if (!this.today) return 'Yet to start work today.';
    if (!this.today.outTime) return `Work started at ${this.formatRowTime(this.today.inTime)}`;
    return `Done — IN ${this.formatRowTime(this.today.inTime)} · OUT ${this.formatRowTime(this.today.outTime)}`;
  }

  get canPunch(): boolean {
    if (!this.settings?.locationBasedEnabled) return false;
    if (!this.today) return true;
    if (this.settings.expectedPunchesPerDay >= 2 && !this.today.outTime) return true;
    return false;
  }

  get bigButtonLabel(): string {
    if (!this.today) return 'Start Workday';
    if (!this.today.outTime) return 'End Workday';
    return 'Done for today';
  }

  get bigButtonIcon(): string {
    if (!this.today) return 'login';
    if (!this.today.outTime) return 'logout';
    return 'verified';
  }

  // ── Formatters ──────────────────────────────

  formatRowTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN',
      { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatRowDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN',
      { weekday: 'short', day: '2-digit', month: 'short' });
  }

  private firstOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private lastOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  private formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
