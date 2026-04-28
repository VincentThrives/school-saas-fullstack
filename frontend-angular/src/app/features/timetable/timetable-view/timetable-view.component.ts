import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SubjectService } from '../../../core/services/subject.service';
import {
  SchoolClass,
  AcademicYear,
  Timetable,
  TimetableDaySchedule,
  TimetablePeriod,
  UserRole,
} from '../../../core/models';

@Component({
  selector: 'app-timetable-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    PageHeaderComponent,
  ],
  templateUrl: './timetable-view.component.html',
  styleUrl: './timetable-view.component.scss',
})
export class TimetableViewComponent implements OnInit {
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  sections: { sectionId: string; name: string }[] = [];

  selectedClassId = '';
  selectedSectionId = '';
  selectedAcademicYearId = '';

  timetable: Timetable | null = null;
  isLoading = false;
  isTeacherView = false;
  isStudentView = false;
  teacherTimetables: Timetable[] = [];

  days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private subjectService: SubjectService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const role = this.auth.currentUser?.role;
    this.isTeacherView = role === UserRole.TEACHER;
    this.isStudentView = role === UserRole.STUDENT;

    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];

      // Check for query params after classes are loaded
      this.route.queryParams.subscribe((params) => {
        if (params['classId'] && params['sectionId'] && params['academicYearId']) {
          this.selectedClassId = params['classId'];
          this.selectedSectionId = params['sectionId'];
          this.selectedAcademicYearId = params['academicYearId'];
          this.onClassChange();
          this.loadTimetable();
        }
      });
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
      }
    });
  }

  get selectedClassName(): string {
    return this.classes.find(c => c.classId === this.selectedClassId)?.name || '';
  }

  get selectedSectionName(): string {
    return this.sections.find(s => s.sectionId === this.selectedSectionId)?.name || '';
  }

  onClassChange(resetSection = false): void {
    const cls = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];
    if (resetSection) {
      this.selectedSectionId = '';
      this.timetable = null;
    }
    if (!this.selectedSectionId && this.sections.length === 1) {
      this.selectedSectionId = this.sections[0].sectionId;
    }
    if (this.selectedSectionId && this.selectedAcademicYearId) {
      this.onSelectionChange();
    }
  }

  onSelectionChange(): void {
    if (this.selectedClassId && this.selectedSectionId && this.selectedAcademicYearId) {
      this.loadTimetable();
    }
  }

  loadTimetable(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.api.getTimetable(this.selectedClassId, this.selectedSectionId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.timetable = res.data || null;
        // Resolve names if not stored
        if (this.timetable) {
          const cls = this.classes.find(c => c.classId === this.selectedClassId);
          const sec = cls?.sections?.find(s => s.sectionId === this.selectedSectionId);
          if (!this.timetable.className) this.timetable.className = cls?.name || '';
          if (!this.timetable.sectionName) this.timetable.sectionName = sec?.name || '';

          // Resolve subject/teacher names in periods
          this.resolveNamesInSchedule();
        }
        this.isLoading = false;
      },
      error: () => {
        this.timetable = null;
        this.isLoading = false;
      },
    });
  }

  private resolveNamesInSchedule(): void {
    if (!this.timetable?.schedule) return;

    // Collect unique subjectIds that need name resolution
    const subjectIds = new Set<string>();
    this.timetable.schedule.forEach(day => {
      day.periods?.forEach(p => {
        if (p.subjectId && !p.subjectName) subjectIds.add(p.subjectId);
      });
    });

    // Fetch subject names
    if (subjectIds.size > 0) {
      this.subjectService.getSubjectsByIds(Array.from(subjectIds)).subscribe({
        next: (subjects) => {
          const nameMap: Record<string, string> = {};
          subjects.forEach(s => { nameMap[s.subjectId] = s.name; });
          this.timetable!.schedule.forEach(day => {
            day.periods?.forEach(p => {
              if (p.subjectId && !p.subjectName && nameMap[p.subjectId]) {
                p.subjectName = nameMap[p.subjectId];
              }
            });
          });
        },
      });
    }

    // Fetch teacher names for periods missing teacherName
    const teacherIds = new Set<string>();
    this.timetable.schedule.forEach(day => {
      day.periods?.forEach(p => {
        if (p.teacherId && !p.teacherName) teacherIds.add(p.teacherId);
      });
    });

    if (teacherIds.size > 0) {
      this.api.getTeachers(0, 200).subscribe({
        next: (res) => {
          const teachers = res.data?.content || [];
          const tMap: Record<string, string> = {};
          teachers.forEach((t: any) => {
            tMap[t.teacherId] = t.firstName ? `${t.firstName} ${t.lastName || ''}`.trim() : t.employeeId || t.teacherId;
          });
          this.timetable!.schedule.forEach(day => {
            day.periods?.forEach(p => {
              if (p.teacherId && !p.teacherName && tMap[p.teacherId]) {
                p.teacherName = tMap[p.teacherId];
              }
            });
          });
        },
      });
    }
  }

  getMaxPeriods(): number {
    if (!this.timetable?.schedule || this.timetable.schedule.length === 0) return 0;
    return Math.max(...this.timetable.schedule.map((d) => d.periods?.length || 0));
  }

  getDaySchedule(day: string): TimetableDaySchedule | undefined {
    return this.timetable?.schedule?.find((d) => d.dayOfWeek === day);
  }

  getPeriod(day: string, periodIndex: number): TimetablePeriod | undefined {
    const daySchedule = this.getDaySchedule(day);
    return daySchedule?.periods?.find((p) => p.periodNumber === periodIndex + 1);
  }

  isLunchBreak(periodIndex: number): boolean {
    return periodIndex === 4;
  }

  isCurrentPeriod(day: string, periodIndex: number): boolean {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[now.getDay()];
    if (currentDay !== day) return false;

    const period = this.getPeriod(day, periodIndex);
    if (!period) return false;

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime >= period.startTime && currentTime <= period.endTime;
  }

  getSubjectName(subjectId: string): string {
    return this.subjectService.getSubjectName(subjectId);
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

  getSubjectBorderColor(subjectId: string): string {
    const colors: Record<string, string> = {
      math: '#1565C0', science: '#2E7D32', english: '#E65100',
      hindi: '#C62828', kannada: '#F9A825', tamil: '#00838F',
      telugu: '#33691E', marathi: '#AD1457', sanskrit: '#4527A0',
      social: '#6A1B9A', history: '#4E342E', geography: '#00695C',
      physics: '#283593', chemistry: '#F9A825', biology: '#00695C',
      computer: '#00838F', evs: '#558B2F', art: '#827717',
      music: '#4527A0', pe: '#BF360C', moral: '#E65100',
    };
    return colors[subjectId] || '#9E9E9E';
  }

  printTimetable(): void {
    window.print();
  }

  downloadTimetable(): void {
    // Create a printable version and trigger download as PDF via browser print
    const printContent = document.querySelector('.timetable-grid');
    if (!printContent) {
      window.print();
      return;
    }

    const win = window.open('', '_blank');
    if (!win) return;

    const className = this.classes.find(c => c.classId === this.selectedClassId)?.name || '';
    const sectionName = this.sections.find(s => s.sectionId === this.selectedSectionId)?.name || '';

    win.document.write(`
      <html>
      <head>
        <title>Timetable - ${className} ${sectionName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #D4A843; margin-bottom: 5px; }
          h3 { text-align: center; color: #666; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #D4A843; color: white; padding: 10px; text-align: center; }
          td { border: 1px solid #ddd; padding: 8px; text-align: center; vertical-align: top; font-size: 12px; }
          .subject { font-weight: bold; }
          .teacher { color: #666; font-size: 11px; }
          .room { color: #999; font-size: 10px; }
          .time { font-size: 10px; color: #888; }
        </style>
      </head>
      <body>
        <h1>Timetable</h1>
        <h3>${className} - ${sectionName}</h3>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Time</th>
    `);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(d => win.document.write(`<th>${d}</th>`));
    win.document.write('</tr></thead><tbody>');

    if (this.timetable?.schedule) {
      const maxPeriods = Math.max(...this.timetable.schedule.map(d => d.periods?.length || 0));
      for (let p = 0; p < maxPeriods; p++) {
        win.document.write('<tr>');
        win.document.write(`<td><strong>${p + 1}</strong></td>`);

        const firstDay = this.timetable.schedule[0]?.periods?.[p];
        win.document.write(`<td class="time">${firstDay?.startTime || ''} - ${firstDay?.endTime || ''}</td>`);

        days.forEach(day => {
          const daySchedule = this.timetable?.schedule?.find(d => d.dayOfWeek === day);
          const period = daySchedule?.periods?.[p];
          if (period?.subjectId) {
            const subName = this.getSubjectName(period.subjectId);
            win.document.write(`<td><div class="subject">${subName}</div><div class="teacher">${period.teacherName || period.teacherId || ''}</div><div class="room">${period.roomNumber || ''}</div></td>`);
          } else {
            win.document.write('<td>-</td>');
          }
        });
        win.document.write('</tr>');
      }
    }

    win.document.write('</tbody></table></body></html>');
    win.document.close();
    win.print();
  }
}
