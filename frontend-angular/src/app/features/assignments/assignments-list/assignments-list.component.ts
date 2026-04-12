import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Assignment, UserRole } from '../../../core/models';

@Component({
  selector: 'app-assignments-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './assignments-list.component.html',
  styleUrl: './assignments-list.component.scss',
})
export class AssignmentsListComponent implements OnInit {
  assignments: Assignment[] = [];
  isLoading = false;
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;

  get isTeacher(): boolean {
    const role = this.authService.currentRole;
    return role === UserRole.TEACHER || role === UserRole.SCHOOL_ADMIN || role === UserRole.PRINCIPAL;
  }

  get isStudent(): boolean {
    return this.authService.currentRole === UserRole.STUDENT;
  }

  get teacherColumns(): string[] {
    return ['title', 'className', 'subjectName', 'dueDate', 'submissions', 'status', 'actions'];
  }

  get studentColumns(): string[] {
    return ['title', 'subjectName', 'dueDate', 'status', 'actions'];
  }

  get displayedColumns(): string[] {
    return this.isTeacher ? this.teacherColumns : this.studentColumns;
  }

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadAssignments();
  }

  loadAssignments(): void {
    this.isLoading = true;
    this.api.getAssignments(this.pageIndex, this.pageSize).subscribe({
      next: (res) => {
        this.assignments = res.data?.content || [];
        this.totalElements = res.data?.totalElements || 0;
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
    this.loadAssignments();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PUBLISHED': return 'status-published';
      case 'DRAFT': return 'status-draft';
      case 'CLOSED': return 'status-closed';
      case 'SUBMITTED': return 'status-submitted';
      case 'GRADED': return 'status-graded';
      case 'LATE': return 'status-late';
      case 'PENDING': return 'status-pending';
      default: return '';
    }
  }

  createAssignment(): void {
    this.router.navigate(['/assignments/new']);
  }

  viewAssignment(id: string): void {
    this.router.navigate(['/assignments', id]);
  }

  editAssignment(id: string): void {
    this.router.navigate(['/assignments', id, 'edit']);
  }
}
