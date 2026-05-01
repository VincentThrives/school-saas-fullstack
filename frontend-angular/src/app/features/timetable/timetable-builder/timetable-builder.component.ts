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

interface SubjectOption {
  subjectId: string;
  name: string;
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

  defaultPeriods: { startTime: string; endTime: string }[] = [
    { startTime: '08:00', endTime: '08:45' },
    { startTime: '08:45', endTime: '09:30' },
    { startTime: '09:30', endTime: '10:15' },
    { startTime: '10:15', endTime: '11:00' },
    // Lunch break after period 4
    { startTime: '11:30', endTime: '12:15' },
    { startTime: '12:15', endTime: '13:00' },
    { startTime: '13:00', endTime: '13:45' },
    { startTime: '13:45', endTime: '14:30' },
  ];

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
      next: (res) => { this.otherYearTimetables = res?.data || []; },
      error: () => { this.otherYearTimetables = []; },
    });
  }

  /**
   * If the given teacher is already assigned to the same day+period in
   * another class+section's timetable for this year, returns a label like
   * "Class 1 — Section a" describing the conflicting slot. Returns ''
   * (empty string) when no conflict.
   *
   * Same-class+section is excluded so editing your own row doesn't fight itself.
   */
  getTeacherConflictLabel(teacherId: string, dayOfWeek: string, periodNumber: number): string {
    if (!teacherId || !dayOfWeek || !periodNumber) return '';
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
          const cls = tt.className || 'another class';
          const sec = tt.sectionName ? ` — Section ${tt.sectionName}` : '';
          return cls + sec;
        }
      }
    }
    return '';
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
        const byId = new Map<string, string>();
        subjects.forEach(s => byId.set(s.subjectId, s.name));
        this.subjects = subjectIds.map(id => ({
          subjectId: id,
          name: byId.get(id) || id,
        }));
      },
      error: () => {
        // Network/API failure — still show the raw ids so the user can pick.
        this.subjects = subjectIds.map(id => ({ subjectId: id, name: id }));
      },
    });
  }

  loadTimetable(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) {
      this.snackBar.open('Please select Class, Section and Academic Year', 'OK', { duration: 3000 });
      return;
    }
    this.isLoading = true;
    this.api.getTimetable(this.selectedClassId, this.selectedSectionId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
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

  initializeEmptySchedule(): void {
    this.schedule = this.days.map((day) => ({
      dayOfWeek: day,
      periods: this.defaultPeriods.map((p, i) => ({
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

  isLunchBreak(periodIndex: number): boolean {
    return periodIndex === 4; // Break after period 4 (0-indexed: 4 means between period 4 and 5)
  }

  addPeriod(): void {
    const maxPeriods = this.getMaxPeriods();
    const lastPeriod = this.defaultPeriods[maxPeriods - 1] || { endTime: '14:30' };
    const [h, m] = lastPeriod.endTime.split(':').map(Number);
    const newStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const endH = m + 45 >= 60 ? h + 1 : h;
    const endM = (m + 45) % 60;
    const newEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

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
        const conflictLabel = this.getTeacherConflictLabel(p.teacherId, day.dayOfWeek, p.periodNumber);
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

  getSubjectName(subjectId: string): string {
    return this.subjects.find((s) => s.subjectId === subjectId)?.name || subjectId;
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
  getTeachersForSubject(subjectId: string): any[] {
    if (!subjectId) return this.teachers;

    // ── Primary: new TeacherSubjectAssignment collection ────────────
    const allowedIds = new Set<string>();
    for (const a of this.yearAssignments) {
      if (a.status === 'ARCHIVED') continue;
      if (a.subjectId !== subjectId) continue;
      if (this.selectedClassId && a.classId !== this.selectedClassId) continue;
      if (this.selectedSectionId && a.sectionId && a.sectionId !== this.selectedSectionId) continue;
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

  onPeriodSubjectChange(daySchedule: any, periodIndex: number): void {
    if (daySchedule.periods[periodIndex]) {
      daySchedule.periods[periodIndex].teacherId = '';
    }
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
