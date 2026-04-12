import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Student, SchoolClass, ApiResponse, PaginatedResponse } from '../../core/models';

@Component({
  selector: 'app-students-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Students</h1>
        <button mat-flat-button class="gold-btn" (click)="router.navigate(['/students/add'])">
          <mat-icon>add</mat-icon> Add Student
        </button>
      </div>

      <mat-card appearance="outlined" class="filter-card">
        <mat-card-content>
          <div class="filter-row">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search students</mat-label>
              <input matInput [(ngModel)]="searchTerm" (keyup.enter)="applyFilter()" placeholder="Name or admission no...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="class-filter">
              <mat-label>Class</mat-label>
              <mat-select [(ngModel)]="selectedClassId" (selectionChange)="applyFilter()">
                <mat-option value="">All Classes</mat-option>
                <mat-option *ngFor="let cls of classes" [value]="cls.id">{{ cls.name }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <div *ngIf="loading" class="loading-wrapper">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <mat-card *ngIf="!loading" appearance="outlined" class="table-card">
        <div class="table-responsive">
          <table mat-table [dataSource]="students" class="full-width-table">
            <ng-container matColumnDef="rollNumber">
              <th mat-header-cell *matHeaderCellDef>Roll No</th>
              <td mat-cell *matCellDef="let s">{{ s.rollNumber || '-' }}</td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let s">{{ s.firstName || '' }} {{ s.lastName || '' }}</td>
            </ng-container>
            <ng-container matColumnDef="className">
              <th mat-header-cell *matHeaderCellDef>Class</th>
              <td mat-cell *matCellDef="let s">{{ s.className || s.classId || '-' }}</td>
            </ng-container>
            <ng-container matColumnDef="admissionNumber">
              <th mat-header-cell *matHeaderCellDef>Admission No</th>
              <td mat-cell *matCellDef="let s">{{ s.admissionNumber }}</td>
            </ng-container>
            <ng-container matColumnDef="gender">
              <th mat-header-cell *matHeaderCellDef>Gender</th>
              <td mat-cell *matCellDef="let s">{{ s.gender }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let s">
                <button mat-icon-button matTooltip="Edit" (click)="router.navigate(['/students', s.studentId, 'edit'])">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteStudent(s.studentId)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            <tr class="mat-row no-data-row" *matNoDataRow>
              <td class="mat-cell" [attr.colspan]="displayedColumns.length">No students found.</td>
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
    .filter-card { margin-bottom: 20px; border-radius: 12px; }
    .filter-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
    .search-field { flex: 1; min-width: 240px; }
    .class-filter { min-width: 180px; }
    .table-card { border-radius: 12px; overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .full-width-table { width: 100%; }
    .loading-wrapper { display: flex; justify-content: center; padding: 64px 0; }
    .no-data-row td { text-align: center; padding: 32px; color: #999; }
  `]
})
export class StudentsListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  students: any[] = [];
  classes: SchoolClass[] = [];
  displayedColumns = ['rollNumber', 'name', 'className', 'admissionNumber', 'gender', 'actions'];
  totalElements = 0;
  pageSize = 10;
  currentPage = 0;
  searchTerm = '';
  selectedClassId = '';
  loading = true;

  constructor(
    private api: ApiService,
    private http: HttpClient,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadStudents();
  }

  loadClasses(): void {
    this.api.getClasses().subscribe({
      next: (res) => this.classes = res.data || [],
      error: () => {}
    });
  }

  loadStudents(): void {
    this.loading = true;
    this.api.getStudents(this.currentPage, this.pageSize, this.selectedClassId || undefined).subscribe({
      next: (res) => {
        const page = res.data;
        this.students = page?.content || [];
        this.totalElements = page?.totalElements || 0;
        this.loading = false;
      },
      error: () => { this.students = []; this.loading = false; }
    });
  }

  applyFilter(): void {
    this.currentPage = 0;
    this.loadStudents();
  }

  onPage(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadStudents();
  }

  deleteStudent(id: string): void {
    if (confirm('Are you sure you want to delete this student?')) {
      this.http.delete(`/api/v1/students/${id}`).subscribe({
        next: () => this.loadStudents(),
        error: () => alert('Failed to delete student.')
      });
    }
  }
}
