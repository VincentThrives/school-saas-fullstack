import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
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
import { Teacher } from '../../../core/models';

@Component({
  selector: 'app-teachers-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
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
  templateUrl: './teachers-list.component.html',
  styleUrl: './teachers-list.component.scss',
})
export class TeachersListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['name', 'employeeId', 'role', 'qualification', 'subjects', 'actions'];
  dataSource = new MatTableDataSource<Teacher>([]);
  pageSize = 10;
  isLoading = false;

  searchQuery = '';

  deleteDialogOpen = false;
  selectedTeacher: Teacher | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // Custom filter so the search box hits every field a school admin
    // might type: first/last name, full name, employee ID, email, phone.
    // MatTableDataSource's default filter only checks the toString of
    // the row, which for an object is "[object Object]" — i.e. matches
    // nothing useful.
    this.dataSource.filterPredicate = (t: Teacher, query: string): boolean => {
      if (!query) return true;
      const q = query.trim().toLowerCase();
      const full = `${t.firstName || ''} ${t.lastName || ''}`.trim();
      const haystack = [t.firstName, t.lastName, full, t.employeeId, t.email, t.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    };
    this.loadTeachers();
  }

  ngAfterViewInit(): void {
    // Hand off pagination to MatTableDataSource so it owns page-size +
    // filter together. Without this the search would clear the current
    // page slice instead of filtering the full dataset.
    this.dataSource.paginator = this.paginator;
  }

  loadTeachers(): void {
    this.isLoading = true;
    // Pull every employee in one shot. Schools cap at ~40-100 staff in
    // practice; 500 is the safe upper bound for the long tail. Lets the
    // browser handle search + pagination over the full set instead of
    // re-querying on every keystroke.
    this.apiService.getTeachers(0, 500).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.dataSource.data = response.data.content || [];
          // Re-apply any active search after a refresh so the user
          // doesn't see all rows reappear when they hit Refresh while
          // a query is in the box.
          this.applySearchFilter();
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  /** Live-search hook — fires on every keystroke via ngModelChange. */
  onSearchChange(): void {
    this.applySearchFilter();
  }

  private applySearchFilter(): void {
    this.dataSource.filter = (this.searchQuery || '').trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  navigateToAddTeacher(): void {
    this.router.navigate(['/employees/new']);
  }

  editTeacher(teacher: Teacher): void {
    this.router.navigate(['/employees', teacher.teacherId, 'edit']);
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
    const teacherId = this.selectedTeacher.teacherId;
    const name = this.selectedTeacher.firstName
      ? `${this.selectedTeacher.firstName} ${this.selectedTeacher.lastName || ''}`
      : this.selectedTeacher.employeeId;
    this.deleteDialogOpen = false;
    this.selectedTeacher = null;

    this.apiService.deleteTeacher(teacherId).subscribe({
      next: () => {
        this.snackBar.open(`Teacher "${name}" deleted successfully`, 'Close', { duration: 3000 });
        this.loadTeachers();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete teacher', 'Close', { duration: 3000 });
      },
    });
  }

  getSubjectNames(teacher: Teacher): string {
    return teacher.subjectIds?.join(', ') || '-';
  }
}
