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

interface UpcomingEventRow {
  id: string;
  title: string;
  date: string;       // ISO yyyy-MM-dd
  kind: 'event' | 'holiday';
  description?: string;
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
  /** Events column in the bottom Events & Holidays card. */
  upcomingEventsOnly: UpcomingEventRow[] = [];
  /** Holidays column in the bottom Events & Holidays card. */
  upcomingHolidaysOnly: UpcomingEventRow[] = [];
  /** Attendance mode controls where the Mark Now / Mark buttons route to.
   *  Resolved from the tenant settings the same way the sidebar does it. */
  attendanceMode: 'DAY_WISE' | 'SUBJECT_WISE' = 'DAY_WISE';

  scheduleColumns = ['period', 'time', 'class', 'subject', 'room', 'attendance'];

  /** Name half of the header greeting — bold, primary size. */
  get greetingName(): string {
    const name = (this.auth.currentUser?.firstName || '').trim() || 'Teacher';
    return `Hi, ${name}`;
  }

  /** Time-of-day tail — smaller and coloured differently so the
   *  emphasis stays on the teacher's name. */
  get greetingTail(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning!';
    if (h < 17) return 'Good afternoon!';
    return 'Good evening!';
  }

  private readonly DAY_KEYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

  constructor(
    private api: ApiService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    // Resolve the school's attendance mode so Mark Now / Mark buttons route
    // to the right page (day-wise vs subject-wise). Falls back to DAY_WISE
    // on error so the buttons still work.
    this.api.getAttendanceMode().subscribe({
      next: (res) => { this.attendanceMode = (res?.data?.mode as any) || 'DAY_WISE'; },
      error: () => { this.attendanceMode = 'DAY_WISE'; },
    });

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const years = (res.data as any[]) || [];
        const current = years.find(y => y.current) || years[0];
        if (!current) { this.isLoading = false; return; }
        this.loadForYear(current.academicYearId);
        this.loadEventsAndHolidays(current.academicYearId);
      },
      error: () => { this.isLoading = false; },
    });
  }

  /** Route the Mark Now / Mark buttons to the page that matches the school's
   *  attendance mode. The super admin's per-school feature toggle decides
   *  which UI is exposed; the dashboard buttons should follow suit. */
  get markAttendanceLink(): string {
    return this.attendanceMode === 'SUBJECT_WISE' ? '/attendance/subject-wise' : '/attendance';
  }

  /** Loads UPCOMING events + holidays for the current academic year and
   *  splits them into the two-column "Events & Holidays" card at the bottom
   *  of the dashboard. Past entries are filtered out — the card is meant
   *  to show what's coming up, not history. Add a future entry on the
   *  Events page and it'll appear here. */
  private loadEventsAndHolidays(academicYearId: string): void {
    forkJoin({
      events: this.api.getEvents({ academicYearId }).pipe(catchError(() => of({ data: [] as any[] } as any))),
      holidays: this.api.getHolidays({ academicYearId }).pipe(catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ events, holidays }) => {
      const today = this.todayStr();
      const eventList: any[] = (events?.data as any[]) || [];
      const holidayList: any[] = (holidays?.data as any[]) || [];

      // Same dedupe rule as the student dashboard: holidays win over events
      // when the backend returns the same row from both endpoints.
      const seenIds = new Set<string>();
      const seenKey = new Set<string>();
      const combined: UpcomingEventRow[] = [];
      const pushIfNew = (row: UpcomingEventRow) => {
        if (row.id && seenIds.has(row.id)) return;
        const key = `${row.date}::${(row.title || '').toLowerCase()}`;
        if (seenKey.has(key)) return;
        if (row.id) seenIds.add(row.id);
        seenKey.add(key);
        combined.push(row);
      };

      holidayList.forEach((h) => {
        const date = h.startDate || h.date;
        if (!date) return;
        // Multi-day holidays: keep visible until the LAST day passes.
        const endDate = h.endDate || date;
        if (endDate < today) return;
        pushIfNew({
          id: h.id || h.holidayId || h.eventId,
          title: h.title || h.name || 'Holiday',
          date,
          kind: 'holiday',
          description: h.description,
        });
      });
      eventList.forEach((e) => {
        const date = e.date || e.startDate || e.eventDate;
        if (!date) return;
        // Filter out events that have already passed.
        const endDate = e.endDate || date;
        if (endDate < today) return;
        if (e.type === 'HOLIDAY' || e.kind === 'HOLIDAY' || e.isHoliday) return;
        pushIfNew({
          id: e.id || e.eventId,
          title: e.title || e.name || 'Event',
          date,
          kind: 'event',
          description: e.description,
        });
      });
      // Soonest first.
      combined.sort((a, b) => a.date.localeCompare(b.date));

      // Cap each column at 3 entries so the card stays compact.
      this.upcomingEventsOnly   = combined.filter(r => r.kind === 'event').slice(0, 3);
      this.upcomingHolidaysOnly = combined.filter(r => r.kind === 'holiday').slice(0, 3);
    });
  }

  /** Format an ISO date as "DD" / "MMM" parts for the date badge. */
  dayPart(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return String(d.getDate()).padStart(2, '0');
  }
  monthPart(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  }
  /** "Today" / "Tomorrow" / "In N days" / formatted date for the meta line.
   *  Only handles upcoming dates — the dashboard filters past entries before
   *  this is called. */
  whenLabel(iso: string): string {
    if (!iso) return '';
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(iso); target.setHours(0,0,0,0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff > 1 && diff <= 7) return `In ${diff} days`;
    return target.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private loadForYear(academicYearId: string): void {
    const userId = this.auth.currentUser?.userId || '';
    if (!userId) { this.isLoading = false; return; }

    forkJoin({
      timetables: this.api.getTeacherTimetable(userId, academicYearId).pipe(catchError(() => of({ data: [] as any[] } as any))),
      assignments: this.api.getMyTeacherAssignments(academicYearId).pipe(catchError(() => of({ data: [] as any[] } as any))),
      exams: this.api.getExams({ academicYearId }).pipe(catchError(() => of({ data: [] as any[] } as any))),
      classes: this.api.getClasses(academicYearId).pipe(catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ timetables, assignments, exams, classes }) => {
      const tts = (timetables?.data as any[]) || [];
      const tas = (assignments?.data as any[]) || [];
      const examList = (exams?.data as any[]) || [];
      const classList = (classes?.data as any[]) || [];

      // {classId → name} and {classId::sectionId → name} maps so the
      // DAY_WISE pending list can show readable labels for sections
      // the teacher is class-teacher of, even when those sections
      // have no periods in today's timetable for this teacher.
      const classNameById = new Map<string, string>();
      const sectionNameByPair = new Map<string, string>();
      for (const c of classList) {
        if (c?.classId) classNameById.set(c.classId, c.name || '');
        for (const s of (c?.sections || [])) {
          if (s?.sectionId) sectionNameByPair.set(`${c.classId}::${s.sectionId}`, s.name || '');
        }
      }

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

      // Pending Attendance — split by mode:
      //
      // DAY_WISE   → driven by CLASS_TEACHER assignments. School
      //              takes one roll-call per (class, section) per
      //              day; the responsibility sits with the class
      //              teacher, regardless of whether any of their
      //              own periods land in that section today.
      // SUBJECT_WISE → keep the timetable-driven flow (one entry
      //              per period the teacher actually has today).
      if (this.attendanceMode === 'DAY_WISE') {
        const ctPairs = new Map<string, { classId: string; sectionId: string; className: string; sectionName: string }>();
        tas.forEach(a => {
          if (!Array.isArray(a.roles) || !a.roles.includes('CLASS_TEACHER')) return;
          if (!a.classId || !a.sectionId) return;
          const key = `${a.classId}::${a.sectionId}`;
          if (ctPairs.has(key)) return;
          ctPairs.set(key, {
            classId: a.classId,
            sectionId: a.sectionId,
            className: classNameById.get(a.classId) || '',
            sectionName: sectionNameByPair.get(key) || '',
          });
        });
        this.computeDayWisePending(Array.from(ctPairs.values()));
      } else {
        this.stampMarkedFlags();
      }

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

    const isDayWise = this.attendanceMode === 'DAY_WISE';
    let completed = 0;
    pairs.forEach(key => {
      const [classId, sectionId] = key.split('::');
      this.api.getBatchAttendance(classId, sectionId, dateStr).subscribe({
        next: (res) => {
          const records = (res?.data as any[]) || [];
          this.todaySchedule.forEach(r => {
            if (r.classId !== classId || r.sectionId !== sectionId) return;
            // In day-wise mode a single periodNumber=0 row covers the
            // whole day for this section — once it exists, every
            // period the teacher has here counts as marked and
            // shouldn't surface as pending.
            const hit = isDayWise
              ? records.find((m: any) => m.periodNumber === 0)
              : records.find((m: any) =>
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

  /**
   * DAY_WISE pending list — one entry per (class, section) the
   * teacher is CLASS_TEACHER of, minus any section whose day-wise
   * StudentsAttendance row (periodNumber=0) already exists for
   * today. Sections with no period in today's timetable for this
   * teacher still appear here — class teachers own roll-call
   * regardless of who teaches what period.
   */
  private computeDayWisePending(
    pairs: Array<{ classId: string; sectionId: string; className: string; sectionName: string }>,
  ): void {
    if (pairs.length === 0) {
      this.classesNeedingAttendance = [];
      this.stats.pendingAttendance = false;
      return;
    }
    const dateStr = this.todayStr();
    const pending: PendingItem[] = [];
    let completed = 0;
    const finish = () => {
      if (++completed < pairs.length) return;
      pending.sort((a, b) =>
        (a.className + a.sectionName).localeCompare(b.className + b.sectionName));
      this.classesNeedingAttendance = pending;
      this.stats.pendingAttendance = pending.length > 0;
    };
    pairs.forEach(p => {
      this.api.getBatchAttendance(p.classId, p.sectionId, dateStr).subscribe({
        next: (res) => {
          const records = (res?.data as any[]) || [];
          const marked = records.some((m: any) => m.periodNumber === 0);
          if (!marked) {
            pending.push({
              className: p.className || 'Class',
              sectionName: p.sectionName || '',
              period: "Today's roll-call",
            });
          }
          finish();
        },
        error: () => finish(),
      });
    });
  }

  private computePending(): void {
    const pending: PendingItem[] = [];
    const seen = new Set<string>();
    const isDayWise = this.attendanceMode === 'DAY_WISE';
    for (const r of this.todaySchedule) {
      if (r.marked) continue;
      // Day-wise mode: dedupe by (class, section). One pending
      // entry per section regardless of how many periods the
      // teacher has there — the school marks the whole day once.
      const k = isDayWise
        ? `${r.classId}::${r.sectionId}`
        : `${r.classId}::${r.sectionId}::${r.periodNumber}`;
      if (seen.has(k)) continue;
      seen.add(k);
      pending.push({
        className: r.className,
        sectionName: r.sectionName,
        period: isDayWise ? "Today's roll-call" : (this.ordinal(r.periodNumber) + ' Period'),
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
