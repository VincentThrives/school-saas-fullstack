import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
    RouterLink,
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

  /**
   * Attendance gate driven by the loaded timetable.
   *
   * <p>Two block states, each with its own banner copy:</p>
   * <ul>
   *   <li>{@code noTimetableConfigured} — no timetable doc exists for
   *       this (class, section, year). Admin is told to set one up
   *       from the Timetables page before marking attendance.</li>
   *   <li>{@code noPeriodsToday} — the timetable exists but the picked
   *       day-of-week has zero periods (or isn't on the schedule at
   *       all). Typical case: Sunday on a Mon-Sat schedule.</li>
   * </ul>
   *
   * <p>Either state hides the Load Students button + shows the
   * dedicated banner. Attendance is blocked in both cases.</p>
   */
  noPeriodsToday = false;
  noPeriodsDayLabel = '';
  noTimetableConfigured = false;

  /**
   * Post-save flow. After a successful {@link saveAttendance}, the
   * roster is hidden and a compact Summary Card replaces it — date,
   * class-section, Present/Absent counters, and an Edit button. The
   * teacher can read off "20 present, 2 absent" without scrolling
   * through 54 rows to confirm what they just saved.
   *
   * <p>Clicking Edit drops back into the editable roster with the same
   * data in place; the Save button label flips to "Update Attendance"
   * so the teacher knows the record already exists.</p>
   *
   * <p>Auto-resets whenever the scope (class / section / date) changes
   * so a stale summary from the previous section never lingers.</p>
   */
  attendanceSaved = false;
  /** True after the teacher clicked Edit on the Summary Card. Drives
   *  the Save button copy ("Update Attendance" vs "Save Attendance"). */
  editMode = false;
  /** Frozen snapshot of present/absent counts at save time. Reading the
   *  live {@link summary} after save would still work for a single
   *  request, but freezing keeps the card stable if the teacher fiddles
   *  with the roster before clicking Edit. */
  savedSummary = { present: 0, absent: 0, total: 0 };
  /** Human-readable scope shown on the Summary Card — e.g.
   *  "Class 1 — Section A · 15 Jun 2026". Cached at save time so a
   *  later date change doesn't rewrite the card. */
  savedScopeLabel = '';
  /** Cached "dayOfWeek (lowercased)" -> period count. Populated lazily
   *  once a (class, section, year) tuple is selected, then re-checked
   *  synchronously on every date change. */
  private timetablePeriodsByDay = new Map<string, number>();
  /** True when the API returned a timetable doc for this scope, even if
   *  its schedule array was empty. Drives strict vs permissive gating:
   *  - doc exists → block any day whose period count is 0 (treats a
   *    bulk-created skeleton timetable as "Sunday closed" the same way
   *    a fully-populated one does).
   *  - no doc → don't block (school doesn't use timetables to gate
   *    attendance — typical of brand-new tenants). */
  private timetableDocExists = false;
  /** Cache key so we only refetch the timetable when one of
   *  (class, section, year) actually changes. */
  private timetableCacheKey = '';

  /** Teacher-mode scoping. When true, only sections this teacher is the
   *  CLASS_TEACHER of (per Teacher Assignment) are shown in the dropdowns.
   *  Admin / principal users bypass. */
  private isTeacherMode = false;
  /** (classId::sectionId) keys this teacher is the CLASS_TEACHER of. Empty
   *  set when not in teacher mode OR teacher has no class-teacher
   *  assignments yet (in which case they see no sections). */
  private myClassTeacherSections = new Set<string>();

  // LATE and HALF_DAY are hidden in the UI per the school's request —
  // commented (not deleted) so they're easy to restore. Backend still
  // accepts those statuses; this is purely a frontend trim.
  readonly statusOptions = [
    { value: 'PRESENT', label: 'Present', icon: 'check_circle', color: '#4caf50' },
    { value: 'ABSENT', label: 'Absent', icon: 'cancel', color: '#f44336' },
    // { value: 'LATE', label: 'Late', icon: 'schedule', color: '#ff9800' },
    // { value: 'HALF_DAY', label: 'Half Day', icon: 'hourglass_bottom', color: '#2196f3' },
  ];

  /**
   * Prefill values lifted from the route query string when the admin
   * arrives from the View Attendance hub. Consumed step-by-step as the
   * async loaders (academic years → classes → sections) resolve so the
   * dropdowns end up matching the picked card without manual clicks.
   * Null when the page was opened directly via the side-nav-deprecated
   * /attendance/mark URL with no prefill (legacy entry).
   */
  private prefill: { classId: string; sectionId: string; date: string } | null = null;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    public features: TenantFeatureService,
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  /**
   * Back button — uses {@link Location#back} so the user lands on
   * whichever page they came from (Dashboard for a class-teacher
   * tapping "Mark Attendance", Attendance Report for a principal
   * drilling in to fix a day, etc.). A hardcoded {@code router.navigate}
   * to the dashboard would be wrong for half the entry paths.
   *
   * <p>If history is empty (deep-linked tab), falls through to the
   * dashboard so the button is never a no-op.</p>
   */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.location.replaceState('/dashboard');
      window.location.href = '/dashboard';
    }
  }

  ngOnInit(): void {
    // Stash any prefill from the View Attendance hub. Empty / missing
    // params → no prefill, and the page renders its legacy dropdown
    // flow exactly as before.
    const qp = this.route.snapshot.queryParamMap;
    const qClass = qp.get('classId') || '';
    const qSection = qp.get('sectionId') || '';
    const qDate = qp.get('date') || '';
    if (qClass && qSection) {
      this.prefill = { classId: qClass, sectionId: qSection, date: qDate };
      if (qDate) {
        // Parse YYYY-MM-DD into a local Date so the picker matches the
        // hub's selected date without timezone drift.
        const parts = qDate.split('-').map(n => parseInt(n, 10));
        if (parts.length === 3 && parts.every(n => !isNaN(n))) {
          this.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        }
      }
    }
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
    this.resetSavedSummary();
    this.refreshHolidayBanner();
    this.refreshNoPeriodsBanner();
    this.maybeAutoLoadStudents();
  }

  /** Apply the hub's prefill once the dropdowns have data to bind against.
   *  Called from loadClasses' next handler so the chain is: classes load →
   *  selectedClassId set → onClassChange populates sections → selectedSectionId
   *  set → onSectionChange triggers the auto-load. Idempotent — only consumes
   *  the prefill once. */
  private applyPrefillIfReady(): void {
    if (!this.prefill) return;
    const wantClass = this.prefill.classId;
    const wantSection = this.prefill.sectionId;
    // Don't run if the picked class doesn't exist for this AY (admin
    // landed via stale link). The hub will show fresh state next time.
    if (!this.classes.some(c => c.classId === wantClass)) {
      this.prefill = null;
      return;
    }
    this.selectedClassId = wantClass;
    this.onClassChange();
    // onClassChange wipes selectedSectionId — re-apply on the next tick
    // so the dropdown registers the change handler before we set the value.
    setTimeout(() => {
      if (this.sections.some(s => s.sectionId === wantSection)) {
        this.selectedSectionId = wantSection;
        this.onSectionChange();
      }
      this.prefill = null;
    }, 0);
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
        // Consume any pending hub prefill now that classes have shape.
        this.applyPrefillIfReady();
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
    // Drop the post-save card the moment the scope changes — otherwise
    // the 1st-A summary lingers on screen while the user is picking 2nd-A.
    this.resetSavedSummary();
    // Class changed → forget the previous timetable cache; the new
    // section pick will trigger a fresh fetch.
    this.timetablePeriodsByDay.clear();
    this.timetableCacheKey = '';
    this.refreshNoPeriodsBanner();
  }

  /** Section dropdown handler — triggers the timetable cache load so
   *  the "no periods today" banner can be evaluated before students load. */
  onSectionChange(): void {
    this.students = [];
    this.studentsLoaded = false;
    this.resetSavedSummary();
    this.maybeLoadTimetableCache();
    // Auto-load runs inside maybeLoadTimetableCache's response handler
    // because the gate result (no-timetable / no-periods) is only known
    // AFTER the timetable API resolves. See refreshNoPeriodsBanner +
    // maybeAutoLoadStudents for the trigger.
  }

  /** Clear the post-save card state. Called from every scope-change
   *  handler so the previous scope's "Today's attendance marked" card
   *  doesn't bleed onto the new scope's screen. */
  private resetSavedSummary(): void {
    this.attendanceSaved = false;
    this.editMode = false;
    this.savedSummary = { present: 0, absent: 0, total: 0 };
    this.savedScopeLabel = '';
  }

  /**
   * Fire {@link loadStudents} the moment every gate clears. Replaces the
   * old "click Load Students" button — a teacher picks AY + class +
   * section + date and the roster appears on its own.
   *
   * <p>Guards:</p>
   * <ul>
   *   <li>All four picks present (AY, class, section, date).</li>
   *   <li>No holiday on the date.</li>
   *   <li>Timetable exists and the picked day-of-week has real periods.</li>
   *   <li>Not already in flight ({@code !isLoading}) — prevents stacking
   *       requests when the date picker spams change events.</li>
   * </ul>
   *
   * <p>Idempotent: re-firing for the same (class, section, date) when
   * students are already loaded for that scope is a no-op; the fetch
   * itself isn't smart about staleness so we early-exit here.</p>
   */
  private lastAutoLoadKey = '';
  private maybeAutoLoadStudents(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) return;
    if (this.isHoliday || this.noPeriodsToday || this.noTimetableConfigured) return;
    if (this.isLoading) return;
    const dateStr = this.formatDate(this.selectedDate);
    const key = `${this.selectedClassId}::${this.selectedSectionId}::${this.selectedAcademicYearId}::${dateStr}`;
    if (key === this.lastAutoLoadKey && this.studentsLoaded) return;
    this.lastAutoLoadKey = key;
    this.loadStudents();
  }

  /**
   * Pull the timetable for the active (class, section, year) once and
   * remember how many periods sit on each day-of-week. The map is the
   * authority for {@link refreshNoPeriodsBanner} — a Sunday entry of 0
   * (or missing) flips the banner on and blocks the Load Students
   * button.
   *
   * <p>No-op when one of the three picks is missing. The cache is keyed
   * on the (class, section, year) tuple so re-picking the same triple
   * (e.g. closing and reopening the section dropdown) doesn't refetch.</p>
   *
   * <p>404 / network error is treated as "no timetable configured" —
   * not a fault state. We don't want a Mongo blip on the timetable
   * endpoint to lock teachers out of marking attendance.</p>
   */
  private maybeLoadTimetableCache(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) {
      this.timetablePeriodsByDay.clear();
      this.timetableDocExists = false;
      this.timetableCacheKey = '';
      this.refreshNoPeriodsBanner();
      return;
    }
    const key = `${this.selectedClassId}::${this.selectedSectionId}::${this.selectedAcademicYearId}`;
    if (key === this.timetableCacheKey) {
      this.refreshNoPeriodsBanner();
      return;
    }
    this.timetableCacheKey = key;
    this.timetablePeriodsByDay.clear();
    this.timetableDocExists = false;
    this.api.getTimetable(this.selectedClassId, this.selectedSectionId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        const doc: any = res?.data;
        this.timetableDocExists = !!(doc && doc.timetableId);
        const schedule = doc?.schedule || [];
        for (const day of schedule) {
          if (!day?.dayOfWeek) continue;
          // Count REAL periods (with a subject assigned), not structural
          // placeholder rows. The default Mon-Sat skeleton created by
          // the bulk-create flow seeds every weekday with empty period
          // rows; without this filter, attendance would load on Friday
          // and Saturday for a section whose schedule was never actually
          // filled in — the very case the school admin wanted blocked.
          //
          // We accept either field shape: subjectId or the cached
          // subjectName, so a legacy doc that only stamped the name
          // still counts as "real".
          const periods: any[] = Array.isArray(day.periods) ? day.periods : [];
          const realCount = periods.reduce((n, p) => {
            const hasSubject = !!(p && (p.subjectId || p.subjectName));
            return n + (hasSubject ? 1 : 0);
          }, 0);
          this.timetablePeriodsByDay.set(
            String(day.dayOfWeek).toLowerCase(),
            realCount
          );
        }
        this.refreshNoPeriodsBanner();
        this.maybeAutoLoadStudents();
      },
      error: () => {
        this.timetableDocExists = false;
        this.timetablePeriodsByDay.clear();
        this.refreshNoPeriodsBanner();
        // No retry of auto-load — the "Timetable not configured" banner
        // is the right end state when this branch fires.
      },
    });
  }

  /** Synchronous evaluator — called from every state change that could
   *  flip the banner: section pick, date change, fresh timetable load.
   *
   *  <p>Strict gate: attendance requires a configured timetable that
   *  has periods for the picked day-of-week. Anything less blocks.</p>
   *
   *  <p>Gating rule (in order):</p>
   *  <ol>
   *    <li>(Class, section, year) not fully picked → no banner, no block.
   *        The Load Students button is already disabled until the admin
   *        finishes picking.</li>
   *    <li>No timetable doc on the server → {@code noTimetableConfigured}.
   *        Banner: "Timetable not configured" with a pointer to the
   *        Timetables page.</li>
   *    <li>Timetable doc exists but the selected day has 0 periods
   *        (either missing entirely from the schedule, or present with
   *        an empty periods array) → {@code noPeriodsToday}.
   *        Banner: "No class scheduled on {Day}".</li>
   *    <li>Timetable doc exists AND the day has periods → all clear.</li>
   *  </ol> */
  private refreshNoPeriodsBanner(): void {
    // (1) Skip the gate until the admin has picked the full scope —
    // showing the banner before a section is chosen would be noise.
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) {
      this.noTimetableConfigured = false;
      this.noPeriodsToday = false;
      this.noPeriodsDayLabel = '';
      return;
    }
    // (2) Timetable missing entirely → block with the "set one up" banner.
    if (!this.timetableDocExists) {
      this.noTimetableConfigured = true;
      this.noPeriodsToday = false;
      this.noPeriodsDayLabel = '';
      this.students = [];
      this.studentsLoaded = false;
      return;
    }
    // (3) Timetable exists — check the picked day.
    this.noTimetableConfigured = false;
    const dayLabel = this.getDayOfWeekLabel(this.selectedDate);
    const periodCount = this.timetablePeriodsByDay.get(dayLabel.toLowerCase()) ?? 0;
    if (periodCount === 0) {
      this.noPeriodsToday = true;
      this.noPeriodsDayLabel = dayLabel;
      this.students = [];
      this.studentsLoaded = false;
    } else {
      this.noPeriodsToday = false;
      this.noPeriodsDayLabel = '';
    }
  }

  private getDayOfWeekLabel(d: Date): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
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
    // Any fresh fetch invalidates the post-save summary; the teacher
    // might be reloading because they switched section or date.
    this.resetSavedSummary();
    this.isLoading = true;
    this.api
      .getStudents(0, 100, { classId: this.selectedClassId, sectionId: this.selectedSectionId })
      .subscribe({
        next: (res) => {
          const studentList = res.data?.content || [];
          // Sort alphabetically by full name so the roll-call reads
          // top-to-bottom the way a teacher expects ("Aadhya, Bindu,
          // Charita, …"). The backend doesn't guarantee any order — it
          // returns whatever Mongo's last write/index hands back, which
          // is usually creation order, not name order.
          this.students = studentList
            .map((s) => ({
              studentId: s.studentId,
              rollNumber: s.rollNumber || '',
              firstName: s.firstName || `Student ${s.admissionNumber || ''}`,
              lastName: s.lastName || '',
              status: 'PRESENT' as const,
              remarks: '',
            }))
            .sort((a, b) => {
              const an = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
              const bn = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
              return an.localeCompare(bn);
            });
          this.studentsLoaded = true;
          this.isLoading = false;
          // If today's attendance was already saved for this scope,
          // restore the summary card so the teacher sees "already
          // marked" instead of an editable roster they could clobber.
          this.checkExistingAttendance();
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open('Failed to load students', 'Close', { duration: 3000 });
        },
      });
  }

  /**
   * After the roster lands, check whether attendance has already been
   * marked for THIS (class, section, date). If yes, apply the saved
   * statuses to {@link students} and flip into the post-save card view
   * — so coming back to a previously-marked scope reads "Today's
   * attendance marked" instead of the editable roster.
   *
   * <p>Day-wise mode only matches batches with periodNumber === 0;
   * period-wise batches (a teacher marked one period) don't trigger
   * the "already marked" state on this page since the day's day-wise
   * roll-call is a separate save.</p>
   */
  private checkExistingAttendance(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedDate) return;
    const dateStr = this.formatDate(this.selectedDate);
    this.api.getBatchAttendance(this.selectedClassId, this.selectedSectionId, dateStr).subscribe({
      next: (res) => {
        const batches: any[] = res?.data || [];
        // Day-wise mode = the batch with no period (periodNumber 0 or null).
        const dayBatch = batches.find(
          b => !b?.periodNumber || b.periodNumber === 0,
        );
        const entries: any[] = dayBatch?.entries || [];
        if (entries.length === 0) return; // no save → keep editable view

        const byStudentId: Record<string, any> = {};
        for (const e of entries) {
          if (e?.studentId) byStudentId[e.studentId] = e;
        }
        // Apply saved status + remarks to the roster so Edit shows the
        // teacher's previous picks instead of resetting to all PRESENT.
        this.students = this.students.map(s => {
          const hit = byStudentId[s.studentId];
          if (!hit) return s;
          return {
            ...s,
            status: (hit.status || 'PRESENT') as StudentAttendance['status'],
            remarks: hit.remarks || '',
          };
        });

        const live = this.summary;
        this.savedSummary = {
          present: live.present,
          absent: live.absent,
          total: this.students.length,
        };
        this.savedScopeLabel = this.computeSavedScopeLabel();
        this.attendanceSaved = true;
        this.editMode = false;
      },
      // Silently swallow — empty/error just leaves the editable view
      // in place, which is the same as "no prior save" behaviour.
      error: () => { /* noop */ },
    });
  }

  markAllPresent(): void {
    this.students = this.students.map((s) => ({ ...s, status: 'PRESENT' as const }));
  }

  /** Display-friendly list of the students currently marked ABSENT.
   *  Surfaces on the post-save summary card so the admin sees WHO is
   *  missing without scrolling the full roster. Sorted by roll number
   *  (numeric-aware) so reloads of the same scope show the same order. */
  get savedAbsentees(): Array<{ rollNumber: string; fullName: string }> {
    return this.students
      .filter(s => s.status === 'ABSENT')
      .map(s => ({
        rollNumber: s.rollNumber || '',
        fullName: ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.studentId,
      }))
      .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
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
          // SMS line dropped — backend stopped auto-dispatching absence
          // SMS on save (see AttendanceService.fireAbsenceAlerts).
          // Mentioning it here would mislead the teacher into thinking
          // parents were already notified when they actually weren't.
          this.snackBar.open('Attendance saved successfully', 'Close', { duration: 3000 });
          // Freeze the summary and flip into the post-save card view.
          const live = this.summary;
          this.savedSummary = {
            present: live.present,
            absent: live.absent,
            total: this.students.length,
          };
          this.savedScopeLabel = this.computeSavedScopeLabel();
          this.attendanceSaved = true;
          this.editMode = false;
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open(err?.error?.message || 'Failed to save attendance', 'Close', { duration: 3000 });
        },
      });
  }

  /** Click handler on the Summary Card's Edit button — drops back into
   *  the editable roster with the previously-marked data intact. The
   *  save button now reads "Update Attendance" because the row already
   *  exists in the DB (backend's markAttendance is upsert-style). */
  editAttendance(): void {
    this.attendanceSaved = false;
    this.editMode = true;
  }

  /** Build "Class 1 — Section A · 15 Jun 2026" for the Summary Card.
   *  Falls back to ids if the lookup tables haven't filled in yet. */
  private computeSavedScopeLabel(): string {
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    const sec = (cls?.sections || []).find((s: any) => s.sectionId === this.selectedSectionId);
    const dateLabel = this.selectedDate.toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const clsLabel = cls?.name || this.selectedClassId;
    const secLabel = (sec as any)?.name || this.selectedSectionId;
    return `${clsLabel} — Section ${secLabel} · ${dateLabel}`;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
