import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Student, SchoolClass, User } from '../../../core/models';

@Component({
  selector: 'app-students-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './students-list.component.html',
  styleUrl: './students-list.component.scss',
})
export class StudentsListComponent implements OnInit {
  displayedColumns: string[] = ['rollNumber', 'name', 'parent', 'classSection', 'admissionNumber', 'gender', 'actions'];
  dataSource = new MatTableDataSource<Student>([]);
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  isLoading = false;

  searchQuery = '';
  classFilter = '';
  sectionFilter = '';
  genderFilter = '';

  classes: SchoolClass[] = [];
  classMap: Record<string, string> = {};
  sectionMap: Record<string, string> = {};
  userMap: Record<string, User> = {};

  deleteDialogOpen = false;
  selectedStudent: Student | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadStudents();
  }

  loadClasses(): void {
    this.apiService.getClasses().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.classes = Array.isArray(response.data) ? response.data : [];
          this.classes.forEach(cls => {
            this.classMap[cls.classId] = cls.name;
            (cls.sections || []).forEach(sec => {
              this.sectionMap[sec.sectionId] = sec.name;
            });
          });
        }
      },
    });
  }

  getClassName(classId: string): string {
    return this.classMap[classId] || '-';
  }

  getSectionName(sectionId: string): string {
    return this.sectionMap[sectionId] || '';
  }

  getClassSection(student: Student): string {
    const cls = this.getClassName(student.classId);
    const sec = student.sectionId ? this.getSectionName(student.sectionId) : '';
    return sec ? `${cls} - ${sec}` : cls;
  }

  getStudentName(student: Student): string {
    // Use firstName/lastName from student directly
    if (student.firstName) {
      return `${student.firstName} ${student.lastName || ''}`.trim();
    }
    // Try user map
    if (student.userId && this.userMap[student.userId]) {
      const user = this.userMap[student.userId];
      return `${user.firstName} ${user.lastName}`.trim();
    }
    // Fallback
    return `Student ${student.admissionNumber || student.rollNumber || ''}`;
  }

  getStudentInitial(student: Student): string {
    if (student.firstName) {
      return student.firstName.charAt(0).toUpperCase();
    }
    if (student.userId && this.userMap[student.userId]) {
      return this.userMap[student.userId].firstName?.charAt(0)?.toUpperCase() || 'S';
    }
    return 'S';
  }

  loadStudents(): void {
    this.isLoading = true;
    const params: any = {};
    if (this.classFilter) params.classId = this.classFilter;
    if (this.sectionFilter) params.sectionId = this.sectionFilter;
    if (this.genderFilter) params.gender = this.genderFilter;
    if (this.searchQuery) params.search = this.searchQuery;

    this.apiService.getStudents(this.pageIndex, this.pageSize, Object.keys(params).length > 0 ? params : undefined).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.dataSource.data = response.data.content || [];
          this.totalElements = response.data.totalElements || 0;

          // Load user data for students that have userId
          const userIds = this.dataSource.data
            .filter(s => s.userId && !this.userMap[s.userId])
            .map(s => s.userId);

          if (userIds.length > 0) {
            this.loadUsers(userIds);
          }
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  loadUsers(userIds: string[]): void {
    // Load each user individually (could be optimized with a bulk endpoint)
    userIds.forEach(userId => {
      this.apiService.getUserById(userId).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.userMap[userId] = res.data;
          }
        },
      });
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadStudents();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadStudents();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadStudents();
  }

  get selectedClassSections(): { name: string; capacity: number; sectionId: string }[] {
    const cls = this.classes.find(c => c.classId === this.classFilter);
    return cls?.sections || [];
  }

  navigateToAddStudent(): void {
    this.router.navigate(['/students/new']);
  }

  navigateToBulkImport(): void {
    this.router.navigate(['/students/import']);
  }

  editStudent(student: Student): void {
    this.router.navigate(['/students', student.studentId, 'edit']);
  }

  confirmDelete(student: Student): void {
    this.selectedStudent = student;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedStudent = null;
  }

  deleteStudent(): void {
    if (!this.selectedStudent) return;
    const studentId = this.selectedStudent.studentId;
    this.deleteDialogOpen = false;
    this.selectedStudent = null;

    this.apiService.deleteStudent(studentId).subscribe({
      next: () => {
        this.snackBar.open('Student deleted successfully', 'Close', { duration: 3000 });
        this.loadStudents();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete student', 'Close', { duration: 3000 });
      },
    });
  }
}
