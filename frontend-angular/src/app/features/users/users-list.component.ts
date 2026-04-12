import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatPaginatorModule, MatCardModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Users</h1>
        <button mat-flat-button class="gold-btn" (click)="router.navigate(['/users/add'])">
          <mat-icon>add</mat-icon> Add User
        </button>
      </div>

      <div *ngIf="loading" class="loading-wrapper">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <mat-card *ngIf="!loading" appearance="outlined" class="table-card">
        <div class="table-responsive">
          <table mat-table [dataSource]="users" class="full-width-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let u">{{ u.firstName }} {{ u.lastName }}</td>
            </ng-container>
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let u">{{ u.email }}</td>
            </ng-container>
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let u">
                <span class="chip role-chip">{{ u.role }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let u">
                <span class="chip" [class.active-chip]="u.isActive" [class.inactive-chip]="!u.isActive">
                  {{ u.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let u">
                <button mat-icon-button matTooltip="Edit" (click)="router.navigate(['/users', u.userId, 'edit'])">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteUser(u.userId)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            <tr class="mat-row no-data-row" *matNoDataRow>
              <td class="mat-cell" [attr.colspan]="displayedColumns.length">No users found.</td>
            </tr>
          </table>
        </div>
        <mat-paginator
          [length]="totalElements"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50]"
          (page)="onPage($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .page-title { font-size: 28px; font-weight: 600; color: #333; margin: 0; }
    .gold-btn { background-color: #D4A843 !important; color: #fff !important; }
    .table-card { border-radius: 12px; overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .full-width-table { width: 100%; }
    .loading-wrapper { display: flex; justify-content: center; padding: 64px 0; }
    .no-data-row td { text-align: center; padding: 32px; color: #999; }
    .chip {
      display: inline-block; padding: 4px 12px; border-radius: 16px;
      font-size: 12px; font-weight: 500;
    }
    .role-chip { background: #D4A843; color: #fff; }
    .active-chip { background: #e8f5e9; color: #2e7d32; }
    .inactive-chip { background: #fce4ec; color: #c62828; }
  `]
})
export class UsersListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  users: User[] = [];
  displayedColumns = ['name', 'email', 'role', 'status', 'actions'];
  totalElements = 0;
  pageSize = 10;
  currentPage = 0;
  loading = true;

  constructor(
    private api: ApiService,
    private http: HttpClient,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.api.getUsers(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        const page = res.data;
        this.users = page?.content || [];
        this.totalElements = page?.totalElements || 0;
        this.loading = false;
      },
      error: () => { this.users = []; this.loading = false; }
    });
  }

  onPage(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }

  deleteUser(id: string): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.http.delete(`/api/v1/users/${id}`).subscribe({
        next: () => this.loadUsers(),
        error: () => alert('Failed to delete user.')
      });
    }
  }
}
