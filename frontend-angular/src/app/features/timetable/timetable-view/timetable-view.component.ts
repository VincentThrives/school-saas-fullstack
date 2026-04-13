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
  teacherTimetables: Timetable[] = [];

  days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const role = this.auth.currentUser?.role;
    this.isTeacherView = role === UserRole.TEACHER;

    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
      }
    });

    // Check for query params
    this.route.queryParams.subscribe((params) => {
      if (params['classId'] && params['sectionId'] && params['academicYearId']) {
        this.selectedClassId = params['classId'];
        this.selectedSectionId = params['sectionId'];
        this.selectedAcademicYearId = params['academicYearId'];
        this.onClassChange();
        this.loadTimetable();
      }
    });
  }

  onClassChange(): void {
    const cls = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];
    if (this.sections.length === 1) {
      this.selectedSectionId = this.sections[0].sectionId;
    }
  }

  loadTimetable(): void {
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.api.getTimetable(this.selectedClassId, this.selectedSectionId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.timetable = res.data || null;
        this.isLoading = false;
      },
      error: () => {
        this.timetable = null;
        this.isLoading = false;
      },
    });
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

  getSubjectColor(subjectId: string): string {
    const colors: Record<string, string> = {
      math: '#E3F2FD',
      science: '#E8F5E9',
      english: '#FFF3E0',
      hindi: '#FCE4EC',
      social: '#F3E5F5',
      computer: '#E0F7FA',
      physics: '#E8EAF6',
      chemistry: '#FFF8E1',
      biology: '#E0F2F1',
      pe: '#FBE9E7',
      art: '#F9FBE7',
      music: '#EDE7F6',
    };
    return colors[subjectId] || '#F5F5F5';
  }

  getSubjectBorderColor(subjectId: string): string {
    const colors: Record<string, string> = {
      math: '#1565C0',
      science: '#2E7D32',
      english: '#E65100',
      hindi: '#C62828',
      social: '#6A1B9A',
      computer: '#00838F',
      physics: '#283593',
      chemistry: '#F9A825',
      biology: '#00695C',
      pe: '#BF360C',
      art: '#827717',
      music: '#4527A0',
    };
    return colors[subjectId] || '#9E9E9E';
  }

  printTimetable(): void {
    window.print();
  }
}
