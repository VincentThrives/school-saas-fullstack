import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear, Teacher } from '../../../core/models';

@Component({
  selector: 'app-classes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './classes-list.component.html',
  styleUrl: './classes-list.component.scss',
})
export class ClassesListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'sections', 'classTeacher', 'academicYear', 'students', 'actions'];
  dataSource = new MatTableDataSource<SchoolClass>([]);
  academicYears: AcademicYear[] = [];
  academicYearMap: Record<string, string> = {};
  teacherMap: Record<string, string> = {};
  studentCountMap: Record<string, number> = {};
  isLoading = false;

  // Filters — empty string means "All"
  selectedAcademicYearId: string = '';
  selectedClassId: string = '';

  // Master list (all classes for the selected year) vs filtered list that feeds the table.
  private allClasses: SchoolClass[] = [];

  deleteDialogOpen = false;
  selectedClass: SchoolClass | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadTeachers();
    // Load years first, pre-select the current one, then load classes scoped to it.
    this.loadAcademicYearsThenClasses();
  }

  private loadAcademicYearsThenClasses(): void {
    this.apiService.getAcademicYears().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const years = Array.isArray(res.data) ? res.data : (res.data as any).content || [];
          this.academicYears = years;
          years.forEach((y: AcademicYear) => {
            this.academicYearMap[y.academicYearId] = y.label;
          });
          // Default filter to the current year (if any). Empty = "All years".
          const current = this.academicYears.find((y) => y.current);
          this.selectedAcademicYearId = current?.academicYearId || '';
        }
        this.loadClasses();
      },
      error: () => {
        this.loadClasses();
      },
    });
  }

  onAcademicYearChange(): void {
    // Changing the year invalidates any class picked from the old year.
    this.selectedClassId = '';
    this.loadClasses();
  }

  onClassFilterChange(): void {
    this.applyClassFilter();
  }

  private applyClassFilter(): void {
    if (!this.selectedClassId) {
      this.dataSource.data = [...this.allClasses];
      return;
    }
    this.dataSource.data = this.allClasses.filter(c => c.classId === this.selectedClassId);
  }

  /** Options for the Class dropdown — always drawn from the year-scoped list. */
  get classOptions(): SchoolClass[] {
    return this.allClasses;
  }

  loadTeachers(): void {
    this.apiService.getTeachers(0, 100).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          (res.data.content || []).forEach((t: Teacher) => {
            const name = t.firstName ? `${t.firstName} ${t.lastName || ''}`.trim() : `Teacher ${t.employeeId || ''}`;
            this.teacherMap[t.teacherId] = name;
          });
        }
      },
    });
  }

  getClassTeacherName(cls: SchoolClass): string {
    const section = cls.sections?.[0];
    if (section?.classTeacherId && this.teacherMap[section.classTeacherId]) {
      return this.teacherMap[section.classTeacherId];
    }
    return '-';
  }

  getAcademicYearLabel(academicYearId: string): string {
    return this.academicYearMap[academicYearId] || academicYearId || '-';
  }

  loadClasses(): void {
    this.isLoading = true;
    // Pass the selected year to the backend; empty means "All years".
    const yearFilter = this.selectedAcademicYearId || undefined;
    this.apiService.getClasses(yearFilter).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.allClasses = Array.isArray(response.data) ? response.data : [];

          // If the picked class isn't in the new year-scoped list, clear it.
          if (this.selectedClassId && !this.allClasses.some(c => c.classId === this.selectedClassId)) {
            this.selectedClassId = '';
          }
          this.applyClassFilter();

          // Load student counts for every loaded class (ignoring the class filter
          // so counts stay accurate if the admin switches back to "All classes").
          this.allClasses.forEach(cls => {
            this.apiService.getStudents(0, 1, { classId: cls.classId }).subscribe({
              next: (res) => {
                if (res.success && res.data) {
                  this.studentCountMap[cls.classId] = res.data.totalElements || 0;
                }
              },
            });
          });
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  navigateToAddClass(): void {
    this.router.navigate(['/classes/new']);
  }

  editClass(schoolClass: SchoolClass): void {
    this.router.navigate(['/classes', schoolClass.classId, 'edit']);
  }

  confirmDelete(schoolClass: SchoolClass): void {
    this.selectedClass = schoolClass;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedClass = null;
  }

  deleteClass(): void {
    if (!this.selectedClass) return;
    const classId = this.selectedClass.classId;
    const className = this.selectedClass.name;
    this.deleteDialogOpen = false;
    this.selectedClass = null;

    this.apiService.deleteClass(classId).subscribe({
      next: () => {
        this.snackBar.open(`Class "${className}" deleted successfully`, 'Close', { duration: 3000 });
        this.loadClasses();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete class', 'Close', { duration: 3000 });
      },
    });
  }

  getSectionsCount(schoolClass: SchoolClass): number {
    return schoolClass.sections?.length || 0;
  }

  getSectionNames(schoolClass: SchoolClass): string[] {
    return schoolClass.sections?.map(s => s.name) || [];
  }

  getEnrolledStudents(schoolClass: SchoolClass): number {
    return this.studentCountMap[schoolClass.classId] || 0;
  }

  getTotalCapacity(schoolClass: SchoolClass): number {
    return schoolClass.sections?.reduce((sum, s) => sum + (s.capacity || 0), 0) || 0;
  }

  getCapacityPercent(schoolClass: SchoolClass): number {
    const capacity = this.getTotalCapacity(schoolClass);
    if (capacity === 0) return 0;
    return Math.round((this.getEnrolledStudents(schoolClass) / capacity) * 100);
  }
}
