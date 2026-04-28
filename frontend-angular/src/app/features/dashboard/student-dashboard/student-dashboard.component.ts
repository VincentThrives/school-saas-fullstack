import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  };

  todaySchedule: ScheduleRow[] = [];
  recentMarks: RecentMarkRow[] = [];
  upcomingMcqExams: McqRow[] = [];
  /** Upcoming events + holidays merged into one chronological list. */
  upcomingEvents: UpcomingEventRow[] = [];
  /** Per-subject attendance breakdown shown in the right-side dashboard card. */
  subjectAttendance: { subjectName: string; percentage: number; present: number; total: number }[] = [];

  scheduleColumns = ['period', 'time', 'subject', 'teacher', 'room'];

  private readonly DAY_KEYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      me: this.api.getMyStudentProfile().pipe(catchError(() => of({ data: null } as any))),
      summary: this.api.getMyProfileSummary().pipe(catchError(() => of({ data: null } as any))),
      mcq: this.api.getAvailableMcqExams().pipe(catchError(() => of({ data: [] as any[] } as any))),
      unread: this.api.getUnreadNotificationCount().pipe(catchError(() => of({ data: 0 } as any))),
      events: this.api.getEvents().pipe(catchError(() => of({ data: [] as any[] } as any))),
      holidays: this.api.getHolidays().pipe(catchError(() => of({ data: [] as any[] } as any))),
    }).subscribe(({ me, summary, mcq, unread, events, holidays }) => {
      const profile = me?.data as any;
      this.stats.attendancePercentage = (summary?.data as any)?.attendance?.overall?.percentage ?? 0;
      this.stats.unreadNotifications = (unread?.data as any) ?? 0;

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
      // 'holiday' kind label.
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
        if (date < today) return;
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
      combined.sort((a, b) => a.date.localeCompare(b.date));
      this.upcomingEvents = combined.slice(0, 5);

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

  /** Color variant for a percentage chip — reuses the existing chip classes
   *  (success / warning / etc.) declared in the dashboard SCSS. */
  pctClass(p: number): string {
    if (p >= 75) return 'student-dashboard__chip--success';
    if (p >= 60) return 'student-dashboard__chip--primary';
    return 'student-dashboard__chip--warning';
  }
}
