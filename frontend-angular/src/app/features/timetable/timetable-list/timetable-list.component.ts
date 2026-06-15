import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  AcademicYear,
  Timetable,
  SchoolClass,
  TimetableDaySchedule,
  UserRole,
} from '../../../core/models';
import { compareClassNames } from '../../../shared/utils/class-sort';

/**
 * One pickable (class × section) pair in the bulk-create multi-select.
 * Schools that share a schedule across, say, 3rd-A / 3rd-B / 4th-A pick
 * all three here and one click creates three timetable docs with the
 * same {@link ScheduleConfig}. Pairs that already have a timetable for
 * the selected academic year are filtered OUT so this control never
 * silently overwrites existing work.
 */
interface ClassSectionPair {
  /** "classId::sectionId" — stable key the multi-select binds on. */
  key: string;
  classId: string;
  sectionId: string;
  classLabel: string;
  sectionLabel: string;
  /** Single-line label rendered in the dropdown ("1st — A"). */
  label: string;
  /** Pre-lowercased haystack for the inline search box. */
  search: string;
}

@Component({
  selector: 'app-timetable-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './timetable-list.component.html',
  styleUrl: './timetable-list.component.scss',
})
export class TimetableListComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  timetables: Timetable[] = [];
  isLoading = false;

  /** All classes for the tenant — kept so we can derive available pairs
   *  for the currently-selected academic year. */
  private classes: SchoolClass[] = [];

  classMap: Record<string, string> = {};
  sectionMap: Record<string, string> = {};

  deleteDialogOpen = false;
  selectedTimetable: Timetable | null = null;

  // ── Bulk create state ────────────────────────────────────────────
  // Schedule settings + class-section multi-select moved here from the
  // builder. One click on "Create" fans out one POST per picked pair,
  // each carrying the same ScheduleConfig so a school can stand up a
  // whole grade's worth of timetables in one go.

  /** Class-section pairs the admin can tick. Filtered to EXCLUDE pairs
   *  that already have a timetable for the selected year — those show
   *  up as cards below instead. */
  pairOptions: ClassSectionPair[] = [];
  /** Picked keys ("classId::sectionId") from {@link pairOptions}. */
  pickedPairKeys: string[] = [];
  /** Inline search inside the multi-select panel. */
  pairSearch = '';
  /** Collapsible Schedule settings — defaults closed so the panel reads
   *  clean for schools running on the standard 8 AM / 45-min schedule. */
  showScheduleSettings = false;
  /** True while the fan-out POST batch is in flight. */
  isCreating = false;

  /**
   * Defaults match the legacy hardcoded shape used by the builder so a
   * school that never touches the panel gets exactly today's behaviour
   * for newly-created timetables.
   */
  config = {
    firstPeriodStart: '08:00',
    periodDurationMinutes: 45,
    periodsBeforeLunch: 4,           // 0 = no lunch row
    lunchStart: '11:00',
    lunchEnd: '11:30',
    displayTimeFormat: 'h12' as 'h12' | 'h24',
  };

  /** Days a default timetable spans. Mirrors {@link TimetableBuilderComponent#days}. */
  private readonly DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Teachers have a dedicated view — send them there.
    if (this.authService.currentRole === UserRole.TEACHER) {
      this.router.navigate(['/my-timetable']);
      return;
    }
    // Students see only their own class+section's timetable, read-only.
    if (this.authService.currentRole === UserRole.STUDENT) {
      this.api.getMyStudentProfile().subscribe({
        next: (res) => {
          const s = res?.data as any;
          if (s?.classId && s?.sectionId) {
            this.router.navigate(['/timetable/view'], {
              queryParams: {
                classId: s.classId,
                sectionId: s.sectionId,
                academicYearId: s.academicYearId,
              },
              replaceUrl: true,
            });
          } else {
            this.snackBar.open('Your class/section is not set yet.', 'Close', { duration: 4000 });
          }
        },
        error: () => {
          this.snackBar.open('Could not load your profile.', 'Close', { duration: 4000 });
        },
      });
      return;
    }
    this.loadClasses();
    this.api.getAcademicYears().subscribe((res) => {
      const data = res.data;
      this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.loadTimetables();
      }
    });
  }

  loadClasses(): void {
    this.api.getClasses().subscribe((res) => {
      const classes: SchoolClass[] = Array.isArray(res.data) ? res.data : [];
      this.classes = classes;
      classes.forEach(cls => {
        this.classMap[cls.classId] = cls.name;
        (cls.sections || []).forEach(sec => {
          this.sectionMap[sec.sectionId] = sec.name;
        });
      });
      // Classes can arrive AFTER the first loadTimetables() call (the
      // two HTTP requests are racing) — rebuild pair options once we
      // have the data on both sides.
      this.rebuildPairOptions();
    });
  }

  getClassName(classId: string): string {
    return this.classMap[classId] || classId;
  }

  getSectionName(sectionId: string): string {
    return this.sectionMap[sectionId] || sectionId;
  }

  onAcademicYearChange(): void {
    // Picked pairs only make sense within the active year; clear and
    // rebuild the option list against the new year's classes +
    // existing timetables.
    this.pickedPairKeys = [];
    this.pairSearch = '';
    this.loadTimetables();
  }

  loadTimetables(): void {
    if (!this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.api.getTimetableList(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        // Canonical school order — LKG → UKG → 1st-A → 1st-B → 2nd-A
        // → … → 10th-B → 12th-C. Class-name comparison uses the shared
        // sort helper that knows about pre-primary (LKG/UKG/Nursery)
        // and numbered grades; section is a stable secondary key so
        // 1st-A always reads above 1st-B.
        this.timetables = (res.data || []).slice().sort((a, b) => {
          const aClassName = this.getClassName(a.classId);
          const bClassName = this.getClassName(b.classId);
          const byClass = compareClassNames(aClassName, bClassName);
          if (byClass !== 0) return byClass;
          const aSec = this.getSectionName(a.sectionId || '');
          const bSec = this.getSectionName(b.sectionId || '');
          return aSec.localeCompare(bSec, undefined, { numeric: true, sensitivity: 'base' });
        });
        this.isLoading = false;
        this.rebuildPairOptions();
      },
      error: () => {
        this.isLoading = false;
        this.rebuildPairOptions();
      },
    });
  }

  /**
   * Rebuild the list of class-section pairs the admin can pick for bulk
   * creation. We list pairs whose class lives in the selected year and
   * whose (class, section) combo does NOT already have a timetable —
   * the existing-card grid below shows those.
   *
   * <p>Safe to call before either dataset has loaded; the resulting
   * list will just be empty until both arrive.</p>
   */
  private rebuildPairOptions(): void {
    if (!this.selectedAcademicYearId || this.classes.length === 0) {
      this.pairOptions = [];
      return;
    }
    const taken = new Set<string>(
      this.timetables.map(tt => `${tt.classId}::${tt.sectionId || ''}`)
    );
    const pairs: ClassSectionPair[] = [];
    for (const cls of this.classes) {
      if ((cls as any).academicYearId !== this.selectedAcademicYearId) continue;
      if (!cls.sections) continue;
      for (const sec of cls.sections as any[]) {
        if (!sec.sectionId) continue;
        const key = `${cls.classId}::${sec.sectionId}`;
        if (taken.has(key)) continue;
        const classLabel = cls.name || '';
        const sectionLabel = sec.name || '';
        const label = `${classLabel} — ${sectionLabel}`;
        const search = [
          classLabel, sectionLabel,
          `${classLabel}${sectionLabel}`,
          `${classLabel} ${sectionLabel}`,
          `${sectionLabel} ${classLabel}`,
          label,
        ].join(' ').toLowerCase();
        pairs.push({
          key,
          classId: cls.classId,
          sectionId: sec.sectionId,
          classLabel,
          sectionLabel,
          label,
          search,
        });
      }
    }
    // Natural-number sort so 1, 2, …, 10 reads in order ("2 — A" before "10 — A").
    pairs.sort((a, b) => {
      const byClass = a.classLabel.localeCompare(b.classLabel, undefined, { numeric: true, sensitivity: 'base' });
      if (byClass !== 0) return byClass;
      return a.sectionLabel.localeCompare(b.sectionLabel, undefined, { numeric: true, sensitivity: 'base' });
    });
    this.pairOptions = pairs;
    // Drop any prior picks that no longer match the new option set.
    const valid = new Set(pairs.map(p => p.key));
    this.pickedPairKeys = this.pickedPairKeys.filter(k => valid.has(k));
  }

  /** Filtered view of {@link pairOptions} for the inline search box. */
  get visiblePairOptions(): ClassSectionPair[] {
    const q = (this.pairSearch || '').trim().toLowerCase();
    if (!q) return this.pairOptions;
    return this.pairOptions.filter(p => p.search.includes(q));
  }

  /** True when every currently-visible pair is ticked — drives the
   *  "Select all / Clear all" toggle row at the top of the dropdown. */
  get allVisiblePairsSelected(): boolean {
    const visible = this.visiblePairOptions;
    if (visible.length === 0) return false;
    const selected = new Set(this.pickedPairKeys);
    return visible.every(p => selected.has(p.key));
  }

  toggleAllVisiblePairs(): void {
    const visible = this.visiblePairOptions;
    if (visible.length === 0) return;
    if (this.allVisiblePairsSelected) {
      const visibleKeys = new Set(visible.map(p => p.key));
      this.pickedPairKeys = this.pickedPairKeys.filter(k => !visibleKeys.has(k));
    } else {
      const merged = new Set(this.pickedPairKeys);
      visible.forEach(p => merged.add(p.key));
      this.pickedPairKeys = Array.from(merged);
    }
  }

  // ── Schedule-config helpers (mirrored from builder) ────────────────
  // Same arithmetic the builder uses so timetables created from the
  // list page render identically the moment an admin opens them.

  /** Format a "HH:mm" string for display per the configured format. */
  formatTime(value: string | undefined | null): string {
    if (!value) return '';
    if (this.config.displayTimeFormat === 'h24') return value;
    const [h, m] = value.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return value;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  /** Add minutes to "HH:mm"; returns "HH:mm". Pure. */
  private addMinutes(time: string, minutes: number): string {
    const [h, m] = (time || '00:00').split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor((total / 60) % 24);
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  /** Minutes between two "HH:mm" strings, or 0 if either is malformed. */
  private diffMinutes(a: string, b: string): number {
    if (!a || !b) return 0;
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    if ([ah, am, bh, bm].some(isNaN)) return 0;
    return (bh * 60 + bm) - (ah * 60 + am);
  }

  /** Auto-snap lunch start to the end of the Nth period, preserving the
   *  current lunch duration. No-op when no-lunch is selected. */
  private snapLunchToPeriodEnd(): void {
    const n = this.config.periodsBeforeLunch || 0;
    if (n <= 0) return;
    const dur = Math.max(5, this.config.periodDurationMinutes || 45);
    const newLunchStart = this.addMinutes(this.config.firstPeriodStart || '08:00', n * dur);
    const oldDur = this.diffMinutes(this.config.lunchStart || '', this.config.lunchEnd || '');
    const lunchDur = oldDur > 0 ? oldDur : 30;
    this.config.lunchStart = newLunchStart;
    this.config.lunchEnd = this.addMinutes(newLunchStart, lunchDur);
  }

  onPeriodsBeforeLunchChanged(): void { this.snapLunchToPeriodEnd(); }
  onPeriodTimingChanged(): void { this.snapLunchToPeriodEnd(); }

  /**
   * Produce the default period list for a brand-new timetable using
   * the current {@link config}. Mirrors the builder so cards created
   * here show the same {periodsBeforeLunch + 4} rows the builder
   * would render. The post-lunch row begins exactly at {@code lunchEnd}.
   */
  private computeDefaultPeriods(): { startTime: string; endTime: string }[] {
    const out: { startTime: string; endTime: string }[] = [];
    const dur = Math.max(5, this.config.periodDurationMinutes || 45);
    const beforeLunch = Math.max(0, this.config.periodsBeforeLunch || 0);
    const totalToGenerate = beforeLunch + 4;
    let cursor = this.config.firstPeriodStart || '08:00';
    for (let i = 0; i < totalToGenerate; i++) {
      const start = cursor;
      const end = this.addMinutes(start, dur);
      out.push({ startTime: start, endTime: end });
      cursor = end;
      if (beforeLunch > 0 && i + 1 === beforeLunch) {
        cursor = this.config.lunchEnd || cursor;
      }
    }
    return out;
  }

  /**
   * Bulk-create timetables for every picked (class × section) pair.
   * Fans out one POST per pair; each carries the same ScheduleConfig
   * and a default empty schedule (default times, blank subject/teacher)
   * so the resulting cards already show "N Periods · 6 Days" instead
   * of "0 Periods" and the admin can jump straight to Edit and fill in
   * subjects.
   *
   * <p>Best-effort across the batch — a failure on one pair doesn't
   * abort the others. Snackbar at the end summarises counts.</p>
   */
  createTimetablesForPickedPairs(): void {
    if (!this.selectedAcademicYearId) {
      this.snackBar.open('Pick an academic year first.', 'Close', { duration: 3000 });
      return;
    }
    if (this.pickedPairKeys.length === 0) {
      this.snackBar.open('Select at least one class–section pair.', 'Close', { duration: 3000 });
      return;
    }

    this.isCreating = true;
    const defaults = this.computeDefaultPeriods();
    const cfgSnapshot = { ...this.config };

    let completed = 0;
    let ok = 0;
    const errs: string[] = [];

    for (const key of this.pickedPairKeys) {
      const opt = this.pairOptions.find(p => p.key === key);
      if (!opt) {
        completed++;
        this.maybeFinishCreate(completed, this.pickedPairKeys.length, ok, errs);
        continue;
      }
      const schedule: TimetableDaySchedule[] = this.DEFAULT_DAYS.map((day) => ({
        dayOfWeek: day,
        periods: defaults.map((p, i) => ({
          periodNumber: i + 1,
          startTime: p.startTime,
          endTime: p.endTime,
          subjectId: '',
          teacherId: '',
          roomNumber: '',
        })),
      }));

      const payload: Partial<Timetable> = {
        classId: opt.classId,
        className: opt.classLabel,
        sectionId: opt.sectionId,
        sectionName: opt.sectionLabel,
        academicYearId: this.selectedAcademicYearId,
        schedule,
        scheduleConfig: cfgSnapshot,
      };

      this.api.saveTimetable(payload).subscribe({
        next: () => {
          ok++;
          this.maybeFinishCreate(++completed, this.pickedPairKeys.length, ok, errs);
        },
        error: (err) => {
          errs.push(err?.error?.message || `Failed for ${opt.label}`);
          this.maybeFinishCreate(++completed, this.pickedPairKeys.length, ok, errs);
        },
      });
    }
  }

  private maybeFinishCreate(completed: number, total: number, ok: number, errs: string[]): void {
    if (completed < total) return;
    this.isCreating = false;
    if (errs.length === 0) {
      this.snackBar.open(`Created ${ok} timetable${ok === 1 ? '' : 's'}`,
        'Close', { duration: 3000 });
    } else if (ok > 0) {
      this.snackBar.open(`Created ${ok}, ${errs.length} failed. ${errs[0]}`,
        'Close', { duration: 4500 });
    } else {
      this.snackBar.open(errs[0] || 'Failed to create timetables', 'Close', { duration: 4500 });
    }
    this.pickedPairKeys = [];
    this.pairSearch = '';
    this.loadTimetables();
  }

  // ── Existing per-card actions (unchanged) ──────────────────────────

  getPeriodCount(timetable: Timetable): number {
    if (!timetable.schedule || timetable.schedule.length === 0) return 0;
    return Math.max(...timetable.schedule.map((d) => d.periods?.length || 0));
  }

  getDayCount(timetable: Timetable): number {
    return timetable.schedule?.length || 0;
  }

  viewTimetable(timetable: Timetable): void {
    this.router.navigate(['/timetable/view'], {
      queryParams: {
        classId: timetable.classId,
        sectionId: timetable.sectionId,
        academicYearId: timetable.academicYearId,
      },
    });
  }

  editTimetable(timetable: Timetable): void {
    this.router.navigate(['/timetable/builder'], {
      queryParams: {
        classId: timetable.classId,
        sectionId: timetable.sectionId,
        academicYearId: timetable.academicYearId,
      },
    });
  }

  confirmDelete(tt: Timetable): void {
    this.selectedTimetable = tt;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedTimetable = null;
  }

  deleteTimetable(): void {
    if (!this.selectedTimetable?.timetableId) return;
    const id = this.selectedTimetable.timetableId;
    this.deleteDialogOpen = false;
    this.selectedTimetable = null;

    this.api.deleteTimetable(id).subscribe({
      next: () => {
        this.snackBar.open('Timetable deleted successfully', 'Close', { duration: 3000 });
        this.loadTimetables();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete timetable', 'Close', { duration: 3000 });
      },
    });
  }
}
