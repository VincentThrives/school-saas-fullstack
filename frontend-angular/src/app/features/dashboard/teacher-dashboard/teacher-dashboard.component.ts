import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface ScheduleRow {
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId?: string;
  subjectName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  room: string;
  marked: boolean;
}

interface PendingItem {
  className: string;
  sectionName: string;
  period: string;
}

interface UpcomingExam {
  name: string;
  class: string;
  date: string;
  subject: string;
}

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatTableModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.scss',
})
export class TeacherDashboardComponent implements OnInit {
  isLoading = true;

  stats = {
    assignedClasses: 0,
    assignedStudents: 0,
    pendingAttendance: false,
    todaysPeriods: 0,
  };

  todaySchedule: ScheduleRow[] = [];
  classesNeedingAttendance: PendingItem[] = [];
  upcomingExams: UpcomingExam[] = [];

  scheduleColumns = ['period', 'time', 'class', 'subject', 'room', 'attendance'];

  private readonly DAY_KEYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

  constructor(
    private api: ApiService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const years = (res.data as any[]) || [];
        const current = years.find(y => y.current) || years[0];
        if (!current) { this.isLoading = false; return; }
        this.loadForYear(current.academicYearId);
      },
      error: () => { this.isLoading = false; },
    });
  }

  private loadForYear(academicYearId: string): void {
    const userId = this.auth.currentUser?.userId || '';
    if (!userId) { this.isLoading = false; return; }

    forkJoin({
      timetables: this.api.getTeacherTimetable(userId, academicYearId).pipe(catchError(() => of({ data: [] as any[] } as any))),
      assignments: this.api.getMyTeacherAssignments(academicYearId).pipe(catchError(() => of({ data: [] as any[] } as any))),
      exams: this.api.getExams({ academicYearId }).pipe(catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ timetables, assignments, exams }) => {
      const tts = (timetables?.data as any[]) || [];
      const tas = (assignments?.data as any[]) || [];
      const examList = (exams?.data as any[]) || [];

      // Class/subject scope = union of timetable + assignments
      const classIds = new Set<string>();
      const sectionPairs = new Set<string>();
      const subjectIds = new Set<string>();
      tts.forEach(t => {
        if (t.classId) classIds.add(t.classId);
        if (t.classId && t.sectionId) sectionPairs.add(`${t.classId}::${t.sectionId}`);
      });
      tas.forEach(a => {
        if (a.classId) classIds.add(a.classId);
        if (a.classId && a.sectionId) sectionPairs.add(`${a.classId}::${a.sectionId}`);
        if (a.subjectId) subjectIds.add(a.subjectId);
      });

      this.stats.assignedClasses = classIds.size;

      // Today's schedule from timetable
      const dayKey = this.DAY_KEYS[new Date().getDay()];
      const rows: ScheduleRow[] = [];
      for (const tt of tts) {
        const day = (tt?.schedule || []).find((d: any) => (d?.dayOfWeek || '').toUpperCase() === dayKey);
        if (!day || !day.periods) continue;
        for (const p of day.periods) {
          if (p.teacherId && p.teacherId !== userId) continue;
          rows.push({
            periodNumber: p.periodNumber,
            startTime: p.startTime,
            endTime: p.endTime,
            subjectId: p.subjectId,
            subjectName: p.subjectName || '',
            classId: tt.classId,
            className: tt.className || '',
            sectionId: tt.sectionId,
            sectionName: tt.sectionName || '',
            room: p.room || tt.room || '',
            marked: false,
          });
        }
      }
      rows.sort((a, b) => a.periodNumber - b.periodNumber);
      this.todaySchedule = rows;
      this.stats.todaysPeriods = rows.length;

      // Stamp "marked" by calling getBatchAttendance once per (classId, sectionId)
      this.stampMarkedFlags();

      // Total students across the teacher's class+section pairs
      this.loadStudentCount(sectionPairs);

      // Upcoming exams the teacher owns (by subjectId scope)
      const todayStr = this.todayStr();
      const upcoming = examList
        .filter(e => !e.subjectId || subjectIds.size === 0 || subjectIds.has(e.subjectId))
        .filter(e => (e.examDate || e.date || '') >= todayStr)
        .sort((a, b) => (a.examDate || a.date || '').localeCompare(b.examDate || b.date || ''))
        .slice(0, 5)
        .map(e => ({
          name: e.name || e.title || 'Exam',
          class: this.formatClass(e),
          date: e.examDate || e.date || '',
          subject: e.subjectName || '',
        }));
      this.upcomingExams = upcoming;

      this.isLoading = false;
    });
  }

  private stampMarkedFlags(): void {
    const dateStr = this.todayStr();
    const seen = new Set<string>();
    const pending: PendingItem[] = [];
    let allMarked = true;
    if (this.todaySchedule.length === 0) {
      this.classesNeedingAttendance = [];
      this.stats.pendingAttendance = false;
      return;
    }

    const pairs = Array.from(new Set(this.todaySchedule
      .filter(r => r.classId && r.sectionId)
      .map(r => `${r.classId}::${r.sectionId}`)));

    if (pairs.length === 0) {
      this.classesNeedingAttendance = [];
      this.stats.pendingAttendance = false;
      return;
    }

    let completed = 0;
    pairs.forEach(key => {
      const [classId, sectionId] = key.split('::');
      this.api.getBatchAttendance(classId, sectionId, dateStr).subscribe({
        next: (res) => {
          const records = (res?.data as any[]) || [];
          this.todaySchedule.forEach(r => {
            if (r.classId !== classId || r.sectionId !== sectionId) return;
            const hit = records.find((m: any) =>
              m.periodNumber === r.periodNumber
              && (!m.subjectId || !r.subjectId || m.subjectId === r.subjectId));
            if (hit) r.marked = true;
          });
          completed++;
          if (completed === pairs.length) this.computePending();
        },
        error: () => {
          completed++;
          if (completed === pairs.length) this.computePending();
        },
      });
    });
  }

  private computePending(): void {
    const pending: PendingItem[] = [];
    const seen = new Set<string>();
    for (const r of this.todaySchedule) {
      if (r.marked) continue;
      const k = `${r.classId}::${r.sectionId}::${r.periodNumber}`;
      if (seen.has(k)) continue;
      seen.add(k);
      pending.push({
        className: r.className,
        sectionName: r.sectionName,
        period: this.ordinal(r.periodNumber) + ' Period',
      });
    }
    this.classesNeedingAttendance = pending;
    this.stats.pendingAttendance = pending.length > 0;
  }

  private loadStudentCount(sectionPairs: Set<string>): void {
    if (sectionPairs.size === 0) {
      this.stats.assignedStudents = 0;
      return;
    }
    let pending = sectionPairs.size;
    let total = 0;
    sectionPairs.forEach(key => {
      const [classId, sectionId] = key.split('::');
      this.api.getStudents(0, 1, { classId, sectionId }).subscribe({
        next: (res) => {
          total += (res.data as any)?.totalElements || 0;
          if (--pending === 0) this.stats.assignedStudents = total;
        },
        error: () => { if (--pending === 0) this.stats.assignedStudents = total; },
      });
    });
  }

  private todayStr(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private ordinal(n: number): string {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return n + 'th';
    if (mod10 === 1) return n + 'st';
    if (mod10 === 2) return n + 'nd';
    if (mod10 === 3) return n + 'rd';
    return n + 'th';
  }

  private formatClass(e: any): string {
    const c = e.className || '';
    const s = e.sectionName ? ' - ' + e.sectionName : '';
    return c + s;
  }
}
