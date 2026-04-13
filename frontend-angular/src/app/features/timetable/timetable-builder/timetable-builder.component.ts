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
import {
  SchoolClass,
  AcademicYear,
  Teacher,
  Timetable,
  TimetableDaySchedule,
  TimetablePeriod,
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

  selectedClassId = '';
  selectedSectionId = '';
  selectedAcademicYearId = '';

  timetable: Timetable | null = null;
  editMode = false;
  isLoading = false;
  isSaving = false;

  days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  schedule: TimetableDaySchedule[] = [];

  // Subjects are typically fetched from subjects API; using a simple list for now
  subjects: SubjectOption[] = [
    { subjectId: 'math', name: 'Mathematics' },
    { subjectId: 'science', name: 'Science' },
    { subjectId: 'english', name: 'English' },
    { subjectId: 'hindi', name: 'Hindi' },
    { subjectId: 'kannada', name: 'Kannada' },
    { subjectId: 'tamil', name: 'Tamil' },
    { subjectId: 'telugu', name: 'Telugu' },
    { subjectId: 'marathi', name: 'Marathi' },
    { subjectId: 'sanskrit', name: 'Sanskrit' },
    { subjectId: 'social', name: 'Social Studies' },
    { subjectId: 'history', name: 'History' },
    { subjectId: 'geography', name: 'Geography' },
    { subjectId: 'physics', name: 'Physics' },
    { subjectId: 'chemistry', name: 'Chemistry' },
    { subjectId: 'biology', name: 'Biology' },
    { subjectId: 'computer', name: 'Computer Science' },
    { subjectId: 'evs', name: 'EVS' },
    { subjectId: 'art', name: 'Art & Craft' },
    { subjectId: 'music', name: 'Music' },
    { subjectId: 'pe', name: 'Physical Education' },
    { subjectId: 'moral', name: 'Moral Science' },
  ];

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
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
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
    this.api.getTeachers(0, 200).subscribe((res) => {
      this.teachers = res.data?.content || [];
    });

    // Check for query params (edit mode)
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
    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedAcademicYearId) {
      this.snackBar.open('Please select Class, Section and Academic Year', 'OK', { duration: 3000 });
      return;
    }
    this.isLoading = true;
    this.api.getTimetable(this.selectedClassId, this.selectedSectionId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        if (res.data && res.data.schedule) {
          this.timetable = res.data;
          this.schedule = res.data.schedule;
          this.editMode = true;
        } else {
          this.initializeEmptySchedule();
          this.editMode = false;
        }
        this.isLoading = false;
      },
      error: () => {
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

    this.isSaving = true;
    const payload: Partial<Timetable> = {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId,
      academicYearId: this.selectedAcademicYearId,
      schedule: this.schedule,
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
    const t = this.teachers.find((t) => t.teacherId === teacherId);
    return t ? `${teacherId}` : teacherId;
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
}
