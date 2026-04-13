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
  isLoading = false;

  deleteDialogOpen = false;
  selectedClass: SchoolClass | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadAcademicYears();
    this.loadTeachers();
    this.loadClasses();
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

  loadAcademicYears(): void {
    this.apiService.getAcademicYears().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const years = Array.isArray(res.data) ? res.data : (res.data as any).content || [];
          this.academicYears = years;
          years.forEach((y: AcademicYear) => {
            this.academicYearMap[y.academicYearId] = y.label;
          });
        }
      },
    });
  }

  getAcademicYearLabel(academicYearId: string): string {
    return this.academicYearMap[academicYearId] || academicYearId || '-';
  }

  loadClasses(): void {
    this.isLoading = true;
    this.apiService.getClasses().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.dataSource.data = Array.isArray(response.data) ? response.data : [];
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

  getTotalStudents(schoolClass: SchoolClass): number {
    return schoolClass.sections?.reduce((sum, s) => sum + (s.capacity || 0), 0) || 0;
  }
}
