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
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { User, UserRole } from '../../../core/models';

@Component({
  selector: 'app-users-list',
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
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    MatSnackBarModule,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
})
export class UsersListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'email', 'role', 'status', 'actions'];
  dataSource = new MatTableDataSource<User>([]);
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  isLoading = false;

  searchQuery = '';
  roleFilter = '';
  statusFilter = '';

  userRoles = Object.values(UserRole);

  deleteDialogOpen = false;
  selectedUser: User | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.apiService.getUsers(this.pageIndex, this.pageSize, { role: this.roleFilter || undefined, status: this.statusFilter || undefined, search: this.searchQuery || undefined }).subscribe({
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
    this.loadUsers();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadUsers();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadUsers();
  }

  navigateToAddUser(): void {
    this.router.navigate(['/users/new']);
  }

  editUser(user: User): void {
    this.router.navigate(['/users', user.userId, 'edit']);
  }

  confirmDelete(user: User): void {
    this.selectedUser = user;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedUser = null;
  }

  deleteUser(): void {
    if (!this.selectedUser) return;
    const userId = this.selectedUser.userId;
    const name = `${this.selectedUser.firstName} ${this.selectedUser.lastName}`;
    this.deleteDialogOpen = false;
    this.selectedUser = null;

    this.apiService.deleteUser(userId).subscribe({
      next: () => {
        this.snackBar.open(`User "${name}" deleted successfully`, 'Close', { duration: 3000 });
        this.loadUsers();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete user', 'Close', { duration: 3000 });
      },
    });
  }

  getRoleColor(role: UserRole): string {
    const colors: Record<string, string> = {
      [UserRole.SUPER_ADMIN]: 'warn',
      [UserRole.SCHOOL_ADMIN]: 'primary',
      [UserRole.PRINCIPAL]: 'accent',
      [UserRole.TEACHER]: 'primary',
      [UserRole.STUDENT]: 'primary',
      [UserRole.PARENT]: 'accent',
    };
    return colors[role] || 'primary';
  }

  formatRole(role: string): string {
    return role.replace(/_/g, ' ');
  }

  getStatusLabel(user: User): string {
    if (user.isLocked) return 'Locked';
    return user.isActive ? 'Active' : 'Inactive';
  }

  getStatusClass(user: User): string {
    if (user.isLocked) return 'status-locked';
    return user.isActive ? 'status-active' : 'status-inactive';
  }
}
