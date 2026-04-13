import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AcademicYear, Timetable, SchoolClass } from '../../../core/models';

@Component({
  selector: 'app-timetable-list',
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
  templateUrl: './timetable-list.component.html',
  styleUrl: './timetable-list.component.scss',
})
export class TimetableListComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  timetables: Timetable[] = [];
  isLoading = false;
  classMap: Record<string, string> = {};
  sectionMap: Record<string, string> = {};

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
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
      classes.forEach(cls => {
        this.classMap[cls.classId] = cls.name;
        (cls.sections || []).forEach(sec => {
          this.sectionMap[sec.sectionId] = sec.name;
        });
      });
    });
  }

  getClassName(classId: string): string {
    return this.classMap[classId] || classId;
  }

  getSectionName(sectionId: string): string {
    return this.sectionMap[sectionId] || sectionId;
  }

  loadTimetables(): void {
    if (!this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.api.getTimetableList(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.timetables = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

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

  createTimetable(): void {
    this.router.navigate(['/timetable/builder']);
  }
}
