import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';

interface ScheduleRow {
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string;
  room: string;
}

interface RecentMarkRow {
  exam: string;
  marks: number;
  total: number;
  grade: string;
}

interface McqRow {
  examId: string;
  title: string;
  duration: number;
  subjectName: string;
}

interface UpcomingEventRow {
  id: string;
  title: string;
  date: string;       // ISO yyyy-MM-dd
  kind: 'event' | 'holiday';
  description?: string;
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.scss',
})
export class StudentDashboardComponent implements OnInit {
  isLoading = true;

  stats = {
    attendancePercentage: 0,
    unreadNotifications: 0,
    /** Homework rows the student has for today. Feeds the dashboard
     *  Homework tile; tapping the tile goes to /homework. */
    todaysHomework: 0,
  };

  /** Student's first name for the personalised "Hi, Ravi" greeting
   *  at the top of the dashboard. Falls back to empty string so the
   *  header renders "Hi, Student" gracefully before the profile
   *  fetch completes. */
  studentFirstName = '';

  /** Name half of the header greeting — bold, primary size. */
  get greetingName(): string {
    return `Hi, ${this.studentFirstName || 'Student'}`;
  }

  /** Time-of-day tail — rendered as a smaller, muted line next to
   *  the name so the whole greeting reads as one visual unit but the
   *  emphasis stays on the student's name. */
  get greetingTail(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning!';
    if (h < 17) return 'Good afternoon!';
    return 'Good evening!';
  }

  /** Short one-liner under the count so the tile reads as a message
   *  instead of a bare number. Kept ≤ 20 chars so it fits on one line
   *  inside the narrow stat-card without wrapping. */
  get homeworkSubtitle(): string {
    const n = this.stats.todaysHomework;
    if (n === 0) return 'Nothing today';
    if (n === 1) return '1 to do · tap';
    return `${n} to do · tap`;
  }

  todaySchedule: ScheduleRow[] = [];
  recentMarks: RecentMarkRow[] = [];
  upcomingMcqExams: McqRow[] = [];
  /** Upcoming events + holidays merged into one chronological list. */
  upcomingEvents: UpcomingEventRow[] = [];
  /** Same data, split for the two-column "Events & Holidays" card. */
  upcomingEventsOnly: UpcomingEventRow[] = [];
  upcomingHolidaysOnly: UpcomingEventRow[] = [];
  /** Per-subject attendance breakdown shown in the right-side dashboard card. */
  subjectAttendance: { subjectName: string; percentage: number; present: number; total: number }[] = [];

  scheduleColumns = ['period', 'time', 'subject', 'teacher', 'room'];

  private readonly DAY_KEYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
  ) {}

  ngOnInit(): void {
    // Today's date in yyyy-MM-dd for the homework filter — matches
    // the backend @DateTimeFormat(ISO.DATE) parser.
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    forkJoin({
      me: this.api.getMyStudentProfile().pipe(catchError(() => of({ data: null } as any))),
      summary: this.api.getMyProfileSummary().pipe(catchError(() => of({ data: null } as any))),
      mcq: this.api.getAvailableMcqExams().pipe(catchError(() => of({ data: [] as any[] } as any))),
      unread: this.api.getUnreadNotificationCount().pipe(catchError(() => of({ data: 0 } as any))),
      events: this.api.getEvents().pipe(catchError(() => of({ data: [] as any[] } as any))),
      holidays: this.api.getHolidays().pipe(catchError(() => of({ data: [] as any[] } as any))),
      homework: this.api.getHomeworkNotifications(todayStr, 0, 1)
        .pipe(catchError(() => of({ data: { content: [], totalElements: 0 } } as any))),
    }).subscribe(({ me, summary, mcq, unread, events, holidays, homework }) => {
      const profile = me?.data as any;
      // First name feeds the personalised "Hi, <name>" header title.
      this.studentFirstName = (profile?.firstName || '').trim();
      this.stats.attendancePercentage = (summary?.data as any)?.attendance?.overall?.percentage ?? 0;
      this.stats.unreadNotifications = (unread?.data as any) ?? 0;
      // totalElements gives the true count even though we asked for
      // just 1 row (page size 1) — cheap way to get "how many today?"
      this.stats.todaysHomework = (homework?.data as any)?.totalElements ?? 0;

      // Subject-wise attendance for the dashboard "Attendance Overview" card
      const bySubject: any[] = (summary?.data as any)?.attendance?.bySubject || [];
      this.subjectAttendance = bySubject
        .map((s) => ({
          subjectName: s.subjectName || s.subjectId || '-',
          percentage: s.percentage ?? 0,
          present: s.present ?? 0,
          total: s.total ?? 0,
        }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

      // Recent marks (top 5 from profile-summary's exams)
      const exams: any[] = (summary?.data as any)?.exams || [];
      this.recentMarks = exams
        .filter((e) => e.marksObtained != null)
        .slice(0, 5)
        .map((e) => ({
          exam: e.examName || 'Exam',
          marks: e.marksObtained || 0,
          total: e.maxMarks || 100,
          grade: e.grade || '-',
        }));

      // Available MCQs (kept on the model for the existing stat-card binding,
      // even though the bottom-row card now shows events & holidays).
      const mcqList: any[] = (mcq?.data as any[]) || [];
      this.upcomingMcqExams = mcqList.slice(0, 5).map((m) => ({
        examId: m.examId || m.id,
        title: m.title || m.name || 'MCQ',
        duration: m.durationMinutes || m.duration || 0,
        subjectName: m.subjectName || this.subjectService.getSubjectName(m.subjectId) || '-',
      }));

      // Merge events + holidays, filter to today-or-later, sort, take next 5.
      // Holidays are stored as the same entity-type as events on the backend
      // (the same `gandhi jayanthi` row comes back from BOTH endpoints), so
      // dedupe by id first, then by (date+title) as a fallback. Holiday wins
      // when the same item is on both — that's the more specific label.
      const today = this.todayStr();
      const eventList: any[] = (events?.data as any[]) || [];
      const holidayList: any[] = (holidays?.data as any[]) || [];

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

      // Process holidays FIRST so they claim shared entries with the
      // 'holiday' kind label. Past entries are filtered out — the dashboard
      // card is meant to show what's coming up, not history.
      holidayList.forEach((h) => {
        const date = h.startDate || h.date;
        if (!date) return;
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
        const endDate = e.endDate || date;
        if (endDate < today) return;
        // Skip events already claimed as holidays.
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
      this.upcomingEvents = combined.slice(0, 5);

      // Split for the two-column dashboard card. Top 3 each by date.
      this.upcomingEventsOnly = combined
        .filter(r => r.kind === 'event')
        .slice(0, 3);
      this.upcomingHolidaysOnly = combined
        .filter(r => r.kind === 'holiday')
        .slice(0, 3);

      // Today's timetable for student's class+section
      if (profile?.classId && profile?.sectionId && profile?.academicYearId) {
        this.api.getTimetable(profile.classId, profile.sectionId, profile.academicYearId).subscribe({
          next: (res) => {
            this.todaySchedule = this.extractToday((res?.data as any)?.schedule || []);
            this.isLoading = false;
          },
          error: () => { this.isLoading = false; },
        });
      } else {
        this.isLoading = false;
      }
    });
  }

  private extractToday(schedule: any[]): ScheduleRow[] {
    const dayKey = this.DAY_KEYS[new Date().getDay()];
    const today = (schedule || []).find((d) => (d?.dayOfWeek || '').toUpperCase() === dayKey);
    if (!today?.periods) return [];
    return (today.periods as any[])
      .map((p) => ({
        periodNumber: p.periodNumber,
        startTime: p.startTime,
        endTime: p.endTime,
        subjectName: p.subjectName || this.subjectService.getSubjectName(p.subjectId) || '-',
        teacherName: p.teacherName || '-',
        room: p.roomNumber || p.room || '-',
      }))
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }

  isGoodAttendance(): boolean {
    return this.stats.attendancePercentage >= 75;
  }

  isGradeA(grade: string): boolean {
    return (grade || '').toString().startsWith('A');
  }

  private todayStr(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

  /** Color variant for a percentage chip — reuses the existing chip classes
   *  (success / warning / etc.) declared in the dashboard SCSS. */
  pctClass(p: number): string {
    if (p >= 75) return 'student-dashboard__chip--success';
    if (p >= 60) return 'student-dashboard__chip--primary';
    return 'student-dashboard__chip--warning';
  }
}
