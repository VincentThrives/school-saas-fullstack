import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DragScrollDirective } from '../../../shared/directives/drag-scroll.directive';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';
import {
  SchoolClass,
  AcademicYear,
  Teacher,
  Timetable,
  TimetableDaySchedule,
  TimetablePeriod,
  TeacherSubjectAssignment,
} from '../../../core/models';

/**
 * One dropdown row in the Subject picker. A subject with multiple
 * attendance-tracked components (Theory + Practical, etc.) expands into
 * one option PER component — e.g. "English (Theory)" and
 * "English (Practical)" — so the admin picks the slice and the subject
 * in a single click. Single-component subjects produce one option whose
 * componentKey is null.
 *
 * {@link value} is the composite "subjectId|componentKey" string used as
 * the mat-select bound value; it round-trips through
 * {@link TimetableBuilderComponent#getPeriodPick} /
 * {@link TimetableBuilderComponent#setPeriodPick}.
 */
interface SubjectOption {
  subjectId: string;
  /** Display label like "English" or "English (Theory)" or "Science (Physics)". */
  label: string;
  /** Composite value bound to the mat-select.
   *  Encoded as "subjectId|componentKey|subPartKey" with empty segments left
   *  blank so the round-trip via {@link TimetableBuilderComponent#getPeriodPick}
   *  and {@link TimetableBuilderComponent#setPeriodPick} preserves every axis. */
  value: string;
  componentKey?: string;
  componentLabel?: string;
  subPartKey?: string;
  subPartLabel?: string;
}

@Component({
  selector: 'app-timetable-builder',
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
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    PageHeaderComponent,
    DragScrollDirective,
  ],
  templateUrl: './timetable-builder.component.html',
  styleUrl: './timetable-builder.component.scss',
})
export class TimetableBuilderComponent implements OnInit {
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  teachers: Teacher[] = [];
  sections: { sectionId: string; name: string }[] = [];

  /** All teacher-subject assignments for the selected academic year. */
  private yearAssignments: TeacherSubjectAssignment[] = [];

  /** Every other timetable in the same year — used to detect cross-class
   *  teacher conflicts (same teacher booked at the same day+period elsewhere). */
  private otherYearTimetables: Timetable[] = [];

  /** Cache of {@code subjectId → groupPeriodAllowed} for every subject that
   *  appears in this year's timetables. Populated after the timetable list
   *  loads so the conflict checker can skip teacher double-bookings when
   *  BOTH the incoming and existing periods are for combined-period subjects
   *  (PE, Assembly, Drill, Library — same teacher legitimately handles many
   *  sections at once). Lookups default to false for unknown ids. */
  private subjectGroupAllowedCache: Map<string, boolean> = new Map();

  selectedClassId = '';
  selectedSectionId = '';
  selectedAcademicYearId = '';

  timetable: Timetable | null = null;
  editMode = false;
  isLoading = false;
  isSaving = false;
  deleteDialogOpen = false;

  days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  schedule: TimetableDaySchedule[] = [];

  subjects: SubjectOption[] = [];

  // ── Schedule configuration (read-only here) ────────────────
  // The settings panel that USED to live in the builder moved to the
  // Timetables list page so a whole grade can be created in one shot
  // with the same shape (see TimetableListComponent#config). The
  // builder still keeps a local `config` object because:
  //   1. loadTimetable() hydrates it from the saved doc — driving the
  //      lunch row position and start/end time rendering of every
  //      period rendered on this page.
  //   2. computeDefaultPeriods() + addPeriod() need it to generate
  //      default times for new rows.
  //   3. saveTimetable() round-trips it back so the next reload sees
  //      the same shape.
  // The DEFAULTS still mirror what the list page generates for a brand-
  // new timetable — so a builder that loads a partially-empty doc renders
  // the same way the list page would.
  config = {
    firstPeriodStart: '08:00',
    periodDurationMinutes: 45,
    periodsBeforeLunch: 4,         // 0 = no lunch row
    lunchStart: '11:00',
    lunchEnd: '11:30',
    displayTimeFormat: 'h12' as 'h12' | 'h24',
  };

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getTeachers(0, 200).subscribe((res) => {
      this.teachers = res.data?.content || [];
    });

    // Years first, then classes for the picked year, then respect any query params.
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.loadYearAssignments();
      }

      this.api.getClasses().subscribe((cres) => {
        this.classes = cres.data || [];

        this.route.queryParams.subscribe((params) => {
          if (params['classId'] && params['sectionId'] && params['academicYearId']) {
            this.selectedAcademicYearId = params['academicYearId'];
            this.selectedClassId = params['classId'];
            this.selectedSectionId = params['sectionId'];
            this.onClassChange();
            this.loadTimetable();
            this.loadSubjectsForClass();
            this.loadYearAssignments();
          }
        });
      });
    });
  }

  /** Pull all TeacherSubjectAssignment rows for the selected year so the
   *  per-period Teacher dropdown can narrow by subject + class + section. */
  private loadYearAssignments(): void {
    if (!this.selectedAcademicYearId) { this.yearAssignments = []; return; }
    this.api.getTeacherAssignments({ academicYearId: this.selectedAcademicYearId }).subscribe({
      next: (res) => { this.yearAssignments = res?.data || []; },
      error: () => { this.yearAssignments = []; },
    });
    // Fetch every timetable for the year so we can warn the admin when a
    // teacher pick would double-book the same period+day in another class.
    this.api.getTimetableList(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.otherYearTimetables = res?.data || [];
        this.refreshSubjectGroupAllowedCache();
      },
      error: () => {
        this.otherYearTimetables = [];
        this.subjectGroupAllowedCache.clear();
      },
    });
  }

  /**
   * If the given teacher is already assigned to the same day+period in
   * another class+section's timetable for this year, returns a label like
   * "Class 1 — Section a" describing the conflicting slot. Returns ''
   * (empty string) when no conflict.
   *
   * <p>Combined-period escape hatch — when {@code incomingSubjectId}
   * resolves to a subject with {@code groupPeriodAllowed=true} AND the
   * existing period's subject also has the flag, the conflict is
   * skipped. Lets PE / Assembly / Drill / Library run across many
   * sections under the same teacher. Math vs PE for the same teacher
   * still flags — only when BOTH sides opt in does the relaxation
   * apply.</p>
   *
   * Same-class+section is excluded so editing your own row doesn't fight itself.
   */
  getTeacherConflictLabel(
      teacherId: string, dayOfWeek: string, periodNumber: number,
      incomingSubjectId?: string): string {
    if (!teacherId || !dayOfWeek || !periodNumber) return '';
    const incomingAllowsGroup = !!incomingSubjectId
        && !!this.subjectGroupAllowedCache.get(incomingSubjectId);
    for (const tt of this.otherYearTimetables) {
      // Skip the timetable being edited (matches by class+section since the
      // id may be missing on a fresh save).
      if (tt.classId === this.selectedClassId && tt.sectionId === this.selectedSectionId) continue;
      if (!tt.schedule) continue;
      for (const day of tt.schedule) {
        if (!day || !day.periods) continue;
        if ((day.dayOfWeek || '').toLowerCase() !== dayOfWeek.toLowerCase()) continue;
        for (const p of day.periods) {
          if (!p || p.teacherId !== teacherId) continue;
          if (p.periodNumber !== periodNumber) continue;
          // Relax the conflict when BOTH sides are combined-period subjects.
          const otherAllowsGroup = !!p.subjectId
              && !!this.subjectGroupAllowedCache.get(p.subjectId);
          if (incomingAllowsGroup && otherAllowsGroup) continue;
          const cls = tt.className || 'another class';
          const sec = tt.sectionName ? ` — Section ${tt.sectionName}` : '';
          return cls + sec;
        }
      }
    }
    return '';
  }

  /**
   * Walk every period in the just-loaded {@link otherYearTimetables},
   * collect distinct subjectIds, fetch those subjects in bulk, and
   * stamp their {@code groupPeriodAllowed} flag into
   * {@link subjectGroupAllowedCache}. Called once per timetable-list
   * refresh; idempotent and quick (one API call regardless of how many
   * timetables we hold).
   */
  private refreshSubjectGroupAllowedCache(): void {
    const ids = new Set<string>();
    for (const tt of this.otherYearTimetables) {
      if (!tt.schedule) continue;
      for (const day of tt.schedule) {
        for (const p of (day.periods || [])) {
          if (p?.subjectId) ids.add(p.subjectId);
        }
      }
    }
    if (ids.size === 0) {
      this.subjectGroupAllowedCache.clear();
      return;
    }
    this.subjectService.getSubjectsByIds(Array.from(ids)).subscribe({
      next: (subs) => {
        const next = new Map<string, boolean>();
        for (const s of subs) {
          next.set(s.subjectId, !!s.groupPeriodAllowed);
        }
        this.subjectGroupAllowedCache = next;
      },
      error: () => { /* keep last good cache on failure */ },
    });
  }

  /** Classes that belong to the selected academic year. Used to drive the Class dropdown. */
  get filteredClasses(): SchoolClass[] {
    if (!this.selectedAcademicYearId) return [];
    return this.classes.filter(c => c.academicYearId === this.selectedAcademicYearId);
  }

  onAcademicYearChange(): void {
    // Changing the year invalidates previously-picked class/section.
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.sections = [];
    this.subjects = [];
    this.schedule = [];
    this.timetable = null;
    this.editMode = false;
    this.loadYearAssignments();
  }

  onClassChange(resetSection = false): void {
    const cls = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];
    if (resetSection) {
      this.selectedSectionId = '';
    }
    if (!this.selectedSectionId && this.sections.length === 1) {
      this.selectedSectionId = this.sections[0].sectionId;
    }
    this.loadSubjectsForClass();
  }

  onSectionChange(): void {
    this.loadSubjectsForClass();
  }

  loadSubjectsForClass(): void {
    if (!this.selectedClassId) {
      this.subjects = [];
      return;
    }
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    let subjectIds: string[] = [];

    if (this.selectedSectionId) {
      const section = cls?.sections?.find(s => s.sectionId === this.selectedSectionId);
      subjectIds = section?.subjectIds || [];
    } else {
      const allIds = new Set<string>();
      cls?.sections?.forEach(s => (s.subjectIds || []).forEach(id => allIds.add(id)));
      subjectIds = Array.from(allIds);
    }

    if (subjectIds.length === 0) {
      this.subjects = [];
      return;
    }

    this.subjectService.getSubjectsByIds(subjectIds).subscribe({
      next: (subjects) => {
        // Map by id so we can fall back to the raw id when a subject isn't
        // registered in the Subjects collection (legacy classes use literal
        // strings like "kannada"/"english" as ids).
        const byId = new Map<string, typeof subjects[number]>();
        subjects.forEach(s => byId.set(s.subjectId, s));
        this.subjects = subjectIds.flatMap(id => this.buildOptionsForSubject(id, byId.get(id)));
      },
      error: () => {
        // Network/API failure — still show the raw ids so the user can pick.
        this.subjects = subjectIds.map(id => ({
          subjectId: id, label: id, value: id,
        }));
      },
    });
  }

  /**
   * Expand a single subject into 1+ dropdown options. Hybrid subjects
   * with multiple attendance-tracked components produce one option per
   * component — labelled "Subject (Component)". Single-component or
   * subjects with at most one attendance-tracked component produce one
   * plain entry. Letting the admin pick "English (Theory)" in a single
   * click is cleaner than asking subject + component separately.
   */
  private buildOptionsForSubject(subjectId: string, sub: any): SubjectOption[] {
    const name = sub?.name || subjectId;
    const subParts = sub?.subParts || [];
    // Sub-parts (teaching axis) take precedence — they're what defines the
    // PERIOD on the timetable (Physics period, Chemistry period). A subject
    // with sub-parts AND multi-components is rare; when it happens we still
    // emit one option per sub-part and let the per-exam component picker
    // handle marks separately.
    if (subParts.length > 0) {
      return subParts.map((sp: any) => ({
        subjectId,
        subPartKey: sp.key,
        subPartLabel: sp.label,
        label: `${name} (${sp.label})`,
        value: `${subjectId}||${sp.key}`,
      } as SubjectOption));
    }
    const tracked = (sub?.components || []).filter((c: any) => c && c.trackAttendance);
    if (tracked.length < 2) {
      return [{ subjectId, label: name, value: `${subjectId}||` }];
    }
    return tracked.map((c: any) => ({
      subjectId,
      componentKey: c.key,
      componentLabel: c.label,
      label: `${name} (${c.label})`,
      value: `${subjectId}|${c.key}|`,
    } as SubjectOption));
  }

  /** Composite value "subjectId|componentKey|subPartKey" bound to the
   *  Subject mat-select. Reads the period back into the dropdown's value
   *  preserving every axis so the picker doesn't lose context on edit. */
  getPeriodPick(period: TimetablePeriod): string {
    if (!period.subjectId) return '';
    return `${period.subjectId}|${period.componentKey || ''}|${period.subPartKey || ''}`;
  }

  /** Apply the composite picked value back to the period — sets
   *  subjectId, componentKey, componentLabel, subPartKey and
   *  subPartLabel together. Clears teacher because the teacher list
   *  depends on (subject, component, sub-part). */
  setPeriodPick(period: TimetablePeriod, value: string): void {
    if (!value) {
      period.subjectId = '';
      period.componentKey = '';
      period.componentLabel = '';
      period.subPartKey = '';
      period.subPartLabel = '';
      period.teacherId = '';
      return;
    }
    const opt = this.subjects.find(s => s.value === value);
    if (!opt) {
      // Legacy data — value may be a plain subjectId or a 2-segment
      // "subjectId|componentKey". Parse forgivingly so old timetables
      // still hydrate without surprises.
      const [sid = '', ck = '', sp = ''] = value.split('|');
      period.subjectId = sid || value;
      period.componentKey = ck || '';
      period.componentLabel = '';
      period.subPartKey = sp || '';
      period.subPartLabel = '';
      period.teacherId = '';
      return;
    }
    period.subjectId = opt.subjectId;
    period.componentKey = opt.componentKey || '';
    period.componentLabel = opt.componentLabel || '';
    period.subPartKey = opt.subPartKey || '';
    period.subPartLabel = opt.subPartLabel || '';
    period.teacherId = '';
  }

  loadTimetable(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) {
      this.snackBar.open('Please select Class, Section and Academic Year', 'OK', { duration: 3000 });
      return;
    }
    this.isLoading = true;
    this.api.getTimetable(this.selectedClassId, this.selectedSectionId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        // Restore schedule config from the saved doc if present. Older
        // timetables saved before scheduleConfig existed fall through to
        // the in-memory defaults — same behaviour as before, no regression.
        if (res.data?.scheduleConfig) {
          const sc = res.data.scheduleConfig;
          this.config = {
            firstPeriodStart: sc.firstPeriodStart || this.config.firstPeriodStart,
            periodDurationMinutes: sc.periodDurationMinutes ?? this.config.periodDurationMinutes,
            periodsBeforeLunch: sc.periodsBeforeLunch ?? this.config.periodsBeforeLunch,
            lunchStart: sc.lunchStart || this.config.lunchStart,
            lunchEnd: sc.lunchEnd || this.config.lunchEnd,
            displayTimeFormat: sc.displayTimeFormat || this.config.displayTimeFormat,
          };
        }
        if (res.data && res.data.schedule && res.data.schedule.length > 0
            && res.data.schedule.some((d: any) => d.periods && d.periods.length > 0)) {
          this.timetable = res.data;
          this.schedule = res.data.schedule;
          this.editMode = true;
        } else if (res.data && res.data.timetableId) {
          // Timetable exists but has empty schedule — load it in edit mode with default periods
          this.timetable = res.data;
          this.initializeEmptySchedule();
          this.editMode = true;
        } else {
          this.initializeEmptySchedule();
          this.editMode = false;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load timetable:', err);
        this.initializeEmptySchedule();
        this.editMode = false;
        this.isLoading = false;
      },
    });
  }

  /** Generate the default period grid from {@link config}. Returns
   *  {@code periodsBeforeLunch + 4} default rows (the +4 keeps a sensible
   *  afternoon stretch the admin can trim down). Times step by
   *  {@code periodDurationMinutes}, with the lunch gap inserted after
   *  the configured Nth period so the row after lunch lines up with
   *  {@code config.lunchEnd}. */
  private computeDefaultPeriods(): { startTime: string; endTime: string }[] {
    const out: { startTime: string; endTime: string }[] = [];
    const dur = Math.max(5, this.config.periodDurationMinutes || 45);
    const beforeLunch = Math.max(0, this.config.periodsBeforeLunch || 0);
    const totalToGenerate = beforeLunch + 4; // leave room post-lunch
    let cursor = this.config.firstPeriodStart || '08:00';
    for (let i = 0; i < totalToGenerate; i++) {
      const start = cursor;
      const end = this.addMinutes(start, dur);
      out.push({ startTime: start, endTime: end });
      cursor = end;
      // After the last pre-lunch period, jump the cursor over the break
      // so the next row begins exactly at lunchEnd.
      if (beforeLunch > 0 && i + 1 === beforeLunch) {
        cursor = this.config.lunchEnd || cursor;
      }
    }
    return out;
  }

  /** Add {@code minutes} to a "HH:mm" string; returns "HH:mm". Pure. */
  private addMinutes(time: string, minutes: number): string {
    const [h, m] = (time || '00:00').split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor((total / 60) % 24);
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  /** Format a "HH:mm" time string for DISPLAY honouring the configured
   *  {@code displayTimeFormat}. "13:00" → "1:00 PM" when h12, or
   *  "13:00" when h24. Edit inputs stay native {@code <input type="time">}
   *  so the browser handles entry; this only governs read-only labels. */
  formatTime(value: string | undefined | null): string {
    if (!value) return '';
    if (this.config.displayTimeFormat === 'h24') return value;
    const [h, m] = value.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return value;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  initializeEmptySchedule(): void {
    const defaults = this.computeDefaultPeriods();
    this.schedule = this.days.map((day) => ({
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
    this.timetable = null;
  }

  getMaxPeriods(): number {
    if (!this.schedule || this.schedule.length === 0) return 0;
    return Math.max(...this.schedule.map((d) => d.periods?.length || 0));
  }

  getPeriodForDay(daySchedule: TimetableDaySchedule, periodIndex: number): TimetablePeriod | undefined {
    return daySchedule.periods?.find((p) => p.periodNumber === periodIndex + 1);
  }

  /** Lunch row sits between {@code periodsBeforeLunch} and the next row.
   *  Returns true for that boundary index. {@code periodsBeforeLunch === 0}
   *  hides the lunch row entirely (KG / half-day classes). */
  isLunchBreak(periodIndex: number): boolean {
    const n = this.config.periodsBeforeLunch || 0;
    return n > 0 && periodIndex === n;
  }

  addPeriod(): void {
    const maxPeriods = this.getMaxPeriods();
    const dur = Math.max(5, this.config.periodDurationMinutes || 45);
    // Anchor the new period to whatever the last existing row ends at —
    // the admin may have hand-edited times so we don't recompute from
    // the config's defaults here.
    const lastEnd = this.schedule[0]?.periods?.[maxPeriods - 1]?.endTime || '14:30';
    const newStart = lastEnd;
    const newEnd = this.addMinutes(newStart, dur);

    this.schedule.forEach((day) => {
      day.periods.push({
        periodNumber: maxPeriods + 1,
        startTime: newStart,
        endTime: newEnd,
        subjectId: '',
        teacherId: '',
        roomNumber: '',
      });
    });
  }

  removePeriod(): void {
    const maxPeriods = this.getMaxPeriods();
    if (maxPeriods <= 1) return;
    this.schedule.forEach((day) => {
      day.periods = day.periods.filter((p) => p.periodNumber !== maxPeriods);
    });
  }

  saveTimetable(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) {
      this.snackBar.open('Please select Class, Section and Academic Year', 'OK', { duration: 3000 });
      return;
    }

    // Pre-check: same teacher booked twice on the same day+period across classes.
    // The backend rejects this too, but we want a clearer message before the request.
    for (const day of this.schedule) {
      for (const p of (day.periods || [])) {
        if (!p.teacherId) continue;
        const conflictLabel = this.getTeacherConflictLabel(
            p.teacherId, day.dayOfWeek, p.periodNumber, p.subjectId);
        if (conflictLabel) {
          const teacherLabel = this.getTeacherName(p.teacherId);
          this.snackBar.open(
            `${teacherLabel} is already teaching ${conflictLabel} for period ${p.periodNumber} on ${day.dayOfWeek}. Pick a different teacher.`,
            'OK', { duration: 5000 });
          return;
        }
      }
    }

    this.isSaving = true;

    // Populate names in schedule before saving
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    const sec = cls?.sections?.find(s => s.sectionId === this.selectedSectionId);
    const scheduleWithNames = this.schedule.map(day => ({
      ...day,
      periods: day.periods.map(p => ({
        ...p,
        // Cached subjectName stays component-FREE — attendance/report renderers
        // append componentLabel separately, so "English" + "(Theory)" don't
        // double up to "English (Theory) (Theory)".
        subjectName: p.subjectId ? this.getSubjectName(p.subjectId) : '',
        teacherName: p.teacherId ? this.getTeacherName(p.teacherId) : '',
      })),
    }));

    const payload: Partial<Timetable> = {
      classId: this.selectedClassId,
      className: cls?.name || '',
      sectionId: this.selectedSectionId,
      sectionName: sec?.name || '',
      academicYearId: this.selectedAcademicYearId,
      schedule: scheduleWithNames,
      // Persist the schedule shape so the next reload restores the same
      // lunch position, period duration, and display format.
      scheduleConfig: { ...this.config },
    };
    if (this.timetable?.timetableId) {
      payload.timetableId = this.timetable.timetableId;
    }

    this.api.saveTimetable(payload).subscribe({
      next: (res) => {
        this.timetable = res.data;
        this.editMode = true;
        this.isSaving = false;
        this.snackBar.open('Timetable saved successfully!', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save timetable', 'OK', { duration: 4000 });
      },
    });
  }

  updateAllDaysTime(periodIndex: number, field: 'startTime' | 'endTime', value: string): void {
    this.schedule.forEach((day) => {
      if (day.periods[periodIndex]) {
        day.periods[periodIndex][field] = value;
      }
    });
  }

  /** Resolve a display name for the period. Includes the component label
   *  in parentheses for hybrid subjects so saved snapshots stay accurate. */
  getSubjectName(subjectId: string, componentKey?: string): string {
    if (!subjectId) return '';
    if (componentKey) {
      const hit = this.subjects.find(s =>
          s.subjectId === subjectId && s.componentKey === componentKey);
      if (hit) return hit.label;
    }
    // Plain or component-less fallback
    const plain = this.subjects.find(s => s.subjectId === subjectId && !s.componentKey);
    if (plain) return plain.label;
    // Last-resort: any matching subjectId (returns first variant's parent name).
    const any = this.subjects.find(s => s.subjectId === subjectId);
    if (any) return any.label.replace(/\s*\([^)]+\)\s*$/, '');
    return subjectId;
  }

  getTeacherName(teacherId: string): string {
    // periods may store either the teacher's userId (new) or teacherId (legacy)
    const t = this.teachers.find((t) => t.userId === teacherId || t.teacherId === teacherId);
    return t ? `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.employeeId || teacherId : teacherId;
  }

  /**
   * Teacher dropdown for a period. Narrowing priority:
   *   1. TeacherSubjectAssignment collection (the canonical year-scoped source)
   *      — match subject + class, and either section equal or wildcard.
   *   2. Legacy Teacher.classSubjectAssignments (pre-migration data).
   *   3. Legacy Teacher.subjectIds (very old data).
   *
   * Only returns teachers who actually teach the selected subject. If no
   * teacher is assigned to the subject yet, returns an empty list (so the
   * admin knows to set up the assignment first, instead of silently picking
   * from unrelated teachers).
   */
  getTeachersForSubject(subjectId: string, componentKey?: string, subPartKey?: string): any[] {
    if (!subjectId) return this.teachers;

    // ── Primary: new TeacherSubjectAssignment collection ────────────
    // Narrow by sub-part FIRST when set — for an integrated Science
    // course's Physics period, only the Physics teacher should appear.
    // componentKey narrowing is secondary; usually the user pre-resolves
    // marks-scheme components via Exam Config, not here.
    const allowedIds = new Set<string>();
    for (const a of this.yearAssignments) {
      if (a.status === 'ARCHIVED') continue;
      if (a.subjectId !== subjectId) continue;
      if (this.selectedClassId && a.classId !== this.selectedClassId) continue;
      if (this.selectedSectionId && a.sectionId && a.sectionId !== this.selectedSectionId) continue;
      if (subPartKey && a.subPartKey && a.subPartKey !== subPartKey) continue;
      if (componentKey && a.componentKey && a.componentKey !== componentKey) continue;
      if (a.teacherId) allowedIds.add(a.teacherId);
    }
    if (allowedIds.size > 0) {
      return this.teachers.filter(t => allowedIds.has(t.teacherId));
    }

    // ── Fallback 1: legacy inline field on Teacher ─────────────────
    const byLegacy = this.teachers.filter(t => (t.classSubjectAssignments || []).some((a: any) =>
      a.subjectId === subjectId
      && a.classId === this.selectedClassId
      && (!a.sectionId || !this.selectedSectionId || a.sectionId === this.selectedSectionId)));
    if (byLegacy.length > 0) return byLegacy;

    // ── Fallback 2: legacy subjectIds list ────────────────────────
    const byIds = this.teachers.filter(t => (t.subjectIds || []).includes(subjectId));
    return byIds;
  }

  /** Convenience for templates: narrow the teacher list by the period's
   *  subject + component + sub-part in one call. */
  getTeachersForPeriod(period: TimetablePeriod): any[] {
    return this.getTeachersForSubject(period.subjectId, period.componentKey, period.subPartKey);
  }

  /** @deprecated use {@link setPeriodPick} — kept only for templates that
   *  haven't migrated yet. Will be removed once nothing references it. */
  onPeriodSubjectChange(daySchedule: any, periodIndex: number): void {
    const p = daySchedule.periods[periodIndex];
    if (!p) return;
    p.teacherId = '';
  }

  getSubjectColor(subjectId: string): string {
    const colors: Record<string, string> = {
      math: '#E3F2FD', science: '#E8F5E9', english: '#FFF3E0',
      hindi: '#FCE4EC', kannada: '#FFF9C4', tamil: '#E0F7FA',
      telugu: '#F1F8E9', marathi: '#FCE4EC', sanskrit: '#EDE7F6',
      social: '#F3E5F5', history: '#EFEBE9', geography: '#E0F2F1',
      physics: '#E8EAF6', chemistry: '#FFF8E1', biology: '#E0F2F1',
      computer: '#E0F7FA', evs: '#F1F8E9', art: '#F9FBE7',
      music: '#EDE7F6', pe: '#FBE9E7', moral: '#FFF3E0',
    };
    return colors[subjectId] || '#F5F5F5';
  }

  printTimetable(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/timetable']);
  }

  confirmDeleteTimetable(): void {
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
  }

  deleteTimetable(): void {
    if (!this.timetable?.timetableId) return;
    this.deleteDialogOpen = false;
    this.isSaving = true;

    this.api.deleteTimetable(this.timetable.timetableId).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Timetable deleted successfully', 'OK', { duration: 3000 });
        this.timetable = null;
        this.editMode = false;
        this.schedule = [];
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to delete timetable', 'OK', { duration: 4000 });
      },
    });
  }
}
