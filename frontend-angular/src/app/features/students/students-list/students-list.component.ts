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
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Student, SchoolClass } from '../../../core/models';

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
    PageHeaderComponent,
  ],
  templateUrl: './students-list.component.html',
  styleUrl: './students-list.component.scss',
})
export class StudentsListComponent implements OnInit {
  displayedColumns: string[] = ['rollNumber', 'name', 'classSection', 'admissionNumber', 'gender', 'actions'];
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

  deleteDialogOpen = false;
  selectedStudent: Student | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadStudents();
  }

  loadClasses(): void {
    this.apiService.getClasses().subscribe({
      next: (response) => {
        this.classes = response.data;
      },
    });
  }

  loadStudents(): void {
    this.isLoading = true;
    this.apiService.getStudents(this.pageIndex, this.pageSize, this.classFilter ? { classId: this.classFilter } : undefined).subscribe({
      next: (response) => {
        this.dataSource.data = response.data.content;
        this.totalElements = response.data.totalElements;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
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

  get selectedClassSections(): { name: string; capacity: number; sectionId?: string }[] {
    const cls = this.classes.find(c => c.id === this.classFilter);
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
    this.deleteDialogOpen = false;
    this.selectedStudent = null;
    this.loadStudents();
  }
}
