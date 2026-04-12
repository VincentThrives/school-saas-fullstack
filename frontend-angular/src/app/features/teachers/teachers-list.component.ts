import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';

interface TeacherRow {
  teacherId: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  qualification: string;
  subjects: string[];
}

@Component({
  selector: 'app-teachers-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatPaginatorModule, MatCardModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Teachers</h1>
      </div>

      <div *ngIf="loading" class="loading-wrapper">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <mat-card *ngIf="!loading" appearance="outlined" class="table-card">
        <div class="table-responsive">
          <table mat-table [dataSource]="teachers" class="full-width-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let t">{{ t.firstName || '' }} {{ t.lastName || '' }}</td>
            </ng-container>
            <ng-container matColumnDef="employeeId">
              <th mat-header-cell *matHeaderCellDef>Employee ID</th>
              <td mat-cell *matCellDef="let t">{{ t.employeeId }}</td>
            </ng-container>
            <ng-container matColumnDef="qualification">
              <th mat-header-cell *matHeaderCellDef>Qualification</th>
              <td mat-cell *matCellDef="let t">{{ t.qualification || '-' }}</td>
            </ng-container>
            <ng-container matColumnDef="subjects">
              <th mat-header-cell *matHeaderCellDef>Subjects</th>
              <td mat-cell *matCellDef="let t">{{ t.subjects?.join(', ') || '-' }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let t">
                <button mat-icon-button matTooltip="Edit" (click)="router.navigate(['/teachers', t.teacherId, 'edit'])">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteTeacher(t.teacherId)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            <tr class="mat-row no-data-row" *matNoDataRow>
              <td class="mat-cell" [attr.colspan]="displayedColumns.length">No teachers found.</td>
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
    .table-card { border-radius: 12px; overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .full-width-table { width: 100%; }
    .loading-wrapper { display: flex; justify-content: center; padding: 64px 0; }
    .no-data-row td { text-align: center; padding: 32px; color: #999; }
  `]
})
export class TeachersListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  teachers: TeacherRow[] = [];
  displayedColumns = ['name', 'employeeId', 'qualification', 'subjects', 'actions'];
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
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.loading = true;
    this.api.getTeachers(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        const page = res.data;
        this.teachers = (page?.content as any[]) || [];
        this.totalElements = page?.totalElements || 0;
        this.loading = false;
      },
      error: () => { this.teachers = []; this.loading = false; }
    });
  }

  onPage(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTeachers();
  }

  deleteTeacher(id: string): void {
    if (confirm('Are you sure you want to delete this teacher?')) {
      this.http.delete(`/api/v1/teachers/${id}`).subscribe({
        next: () => this.loadTeachers(),
        error: () => alert('Failed to delete teacher.')
      });
    }
  }
}
