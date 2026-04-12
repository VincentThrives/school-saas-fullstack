import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { SchoolClass } from '../../core/models';

@Component({
  selector: 'app-classes-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatCardModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Classes</h1>
        <button mat-flat-button class="gold-btn" (click)="router.navigate(['/classes/add'])">
          <mat-icon>add</mat-icon> Add Class
        </button>
      </div>

      <div *ngIf="loading" class="loading-wrapper">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <mat-card *ngIf="!loading" appearance="outlined" class="table-card">
        <div class="table-responsive">
          <table mat-table [dataSource]="classes" class="full-width-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let c">{{ c.name }}</td>
            </ng-container>
            <ng-container matColumnDef="sections">
              <th mat-header-cell *matHeaderCellDef>Sections</th>
              <td mat-cell *matCellDef="let c">{{ c.sections?.length || 0 }}</td>
            </ng-container>
            <ng-container matColumnDef="academicYearId">
              <th mat-header-cell *matHeaderCellDef>Academic Year</th>
              <td mat-cell *matCellDef="let c">{{ c.academicYearId || '-' }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let c">
                <button mat-icon-button matTooltip="Edit" (click)="router.navigate(['/classes', c.id, 'edit'])">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteClass(c.id)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            <tr class="mat-row no-data-row" *matNoDataRow>
              <td class="mat-cell" [attr.colspan]="displayedColumns.length">No classes found.</td>
            </tr>
          </table>
        </div>
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
  `]
})
export class ClassesListComponent implements OnInit {
  classes: SchoolClass[] = [];
  displayedColumns = ['name', 'sections', 'academicYearId', 'actions'];
  loading = true;

  constructor(
    private api: ApiService,
    private http: HttpClient,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  loadClasses(): void {
    this.loading = true;
    this.api.getClasses().subscribe({
      next: (res) => { this.classes = res.data || []; this.loading = false; },
      error: () => { this.classes = []; this.loading = false; }
    });
  }

  deleteClass(id: string): void {
    if (confirm('Are you sure you want to delete this class?')) {
      this.http.delete(`/api/v1/classes/${id}`).subscribe({
        next: () => this.loadClasses(),
        error: () => alert('Failed to delete class.')
      });
    }
  }
}
