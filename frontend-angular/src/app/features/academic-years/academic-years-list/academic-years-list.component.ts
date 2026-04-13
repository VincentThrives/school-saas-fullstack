import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-academic-years-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './academic-years-list.component.html',
  styleUrl: './academic-years-list.component.scss',
})
export class AcademicYearsListComponent implements OnInit {
  displayedColumns: string[] = ['label', 'startDate', 'endDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<AcademicYear>([]);
  isLoading = false;

  // Create dialog state
  createDialogOpen = false;
  newLabel = '';
  newStartDate = '';
  newEndDate = '';
  isCreating = false;

  // Delete dialog state
  deleteDialogOpen = false;
  selectedYear: AcademicYear | null = null;

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  get currentYearLabel(): string {
    const current = this.dataSource.data.find(y => y.current);
    return current ? current.label : '';
  }

  ngOnInit(): void {
    this.loadAcademicYears();
  }

  loadAcademicYears(): void {
    this.isLoading = true;
    this.apiService.getAcademicYears().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Handle both array and paginated responses
          if (Array.isArray(response.data)) {
            this.dataSource.data = response.data;
          } else if ((response.data as any).content) {
            this.dataSource.data = (response.data as any).content;
          } else {
            this.dataSource.data = [];
          }
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load academic years:', err);
        this.isLoading = false;
      },
    });
  }

  openCreateDialog(): void {
    this.suggestNextYear();
    this.createDialogOpen = true;
  }

  closeCreateDialog(): void {
    this.createDialogOpen = false;
    this.newLabel = '';
    this.newStartDate = '';
    this.newEndDate = '';
  }

  suggestNextYear(): void {
    const currentYear = new Date().getFullYear();
    const existingLabels = this.dataSource.data.map(ay => ay.label);
    for (let y = currentYear; y <= currentYear + 5; y++) {
      const label = `${y}-${y + 1}`;
      if (!existingLabels.includes(label)) {
        this.newLabel = label;
        this.newStartDate = `${y}-04-01`;
        this.newEndDate = `${y + 1}-03-31`;
        return;
      }
    }
    this.newLabel = '';
    this.newStartDate = '';
    this.newEndDate = '';
  }

  createAcademicYear(): void {
    if (!this.newLabel.trim() || !this.newStartDate || !this.newEndDate) {
      this.snackBar.open('Please fill all fields', 'Close', { duration: 3000 });
      return;
    }

    this.isCreating = true;
    this.apiService.createAcademicYear({
      label: this.newLabel.trim(),
      startDate: this.newStartDate,
      endDate: this.newEndDate,
    }).subscribe({
      next: () => {
        this.snackBar.open(`Academic year "${this.newLabel}" created successfully`, 'Close', { duration: 3000 });
        this.closeCreateDialog();
        this.loadAcademicYears();
        this.isCreating = false;
      },
      error: (err) => {
        console.error('Failed to create academic year:', err);
        const msg = err?.error?.message || 'Failed to create academic year';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
        this.isCreating = false;
      },
    });
  }

  confirmDelete(year: AcademicYear): void {
    this.selectedYear = year;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedYear = null;
  }

  deleteYear(): void {
    if (!this.selectedYear) return;
    this.deleteDialogOpen = false;
    this.selectedYear = null;
    this.loadAcademicYears();
  }

  setAsCurrent(year: AcademicYear): void {
    this.snackBar.open(`"${year.label}" set as current academic year`, 'Close', { duration: 3000 });
    this.loadAcademicYears();
  }

  archiveYear(year: AcademicYear): void {
    this.snackBar.open(`"${year.label}" archived successfully`, 'Close', { duration: 3000 });
    this.loadAcademicYears();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getStatusLabel(year: AcademicYear): string {
    if (year.current) return 'Current';
    return 'Archived';
  }

  getStatusClass(year: AcademicYear): string {
    if (year.current) return 'status-current';
    return 'status-archived';
  }
}
