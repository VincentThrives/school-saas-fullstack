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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Teacher } from '../../../core/models';

@Component({
  selector: 'app-teachers-list',
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
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './teachers-list.component.html',
  styleUrl: './teachers-list.component.scss',
})
export class TeachersListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'employeeId', 'qualification', 'specialization', 'subjects', 'actions'];
  dataSource = new MatTableDataSource<Teacher>([]);
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  isLoading = false;

  searchQuery = '';

  deleteDialogOpen = false;
  selectedTeacher: Teacher | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.isLoading = true;
    this.apiService.getTeachers(this.pageIndex, this.pageSize).subscribe({
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
    this.loadTeachers();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadTeachers();
  }

  navigateToAddTeacher(): void {
    this.router.navigate(['/teachers/new']);
  }

  editTeacher(teacher: Teacher): void {
    this.router.navigate(['/teachers', teacher.teacherId, 'edit']);
  }

  confirmDelete(teacher: Teacher): void {
    this.selectedTeacher = teacher;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedTeacher = null;
  }

  deleteTeacher(): void {
    if (!this.selectedTeacher) return;
    this.deleteDialogOpen = false;
    this.selectedTeacher = null;
    this.loadTeachers();
  }

  getSubjectNames(teacher: Teacher): string {
    return teacher.subjectIds?.join(', ') || '-';
  }
}
