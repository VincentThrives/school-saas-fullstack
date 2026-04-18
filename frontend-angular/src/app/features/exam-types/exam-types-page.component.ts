import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ApiService } from '../../core/services/api.service';

interface Row {
  id?: string;
  name: string;
  displayOrder: number;
  defaultMaxMarks?: number | null;
  description?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
}

@Component({
  selector: 'app-exam-types-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatTooltipModule, MatChipsModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './exam-types-page.component.html',
  styleUrl: './exam-types-page.component.scss',
})
export class ExamTypesPageComponent implements OnInit {
  types: Row[] = [];
  isLoading = false;
  showArchived = false;

  // Editor dialog state
  editorOpen = false;
  editing: Row | null = null;
  form: Row = this.blankForm();
  isSaving = false;

  // Delete confirmation
  deleteDialogOpen = false;
  rowToDelete: Row | null = null;
  isDeleting = false;

  displayedColumns = ['displayOrder', 'name', 'defaultMaxMarks', 'description', 'status', 'actions'];

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.api.getExamTypes(this.showArchived).subscribe({
      next: (res) => {
        this.types = res?.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam types', 'Close', { duration: 3000 });
      },
    });
  }

  onToggleArchived(): void {
    this.load();
  }

  blankForm(): Row {
    return { name: '', displayOrder: 1, defaultMaxMarks: null, description: '' };
  }

  openCreate(): void {
    this.editing = null;
    // Next sensible display order = max+1
    const maxOrder = this.types.reduce((m, t) => Math.max(m, t.displayOrder || 0), 0);
    this.form = { ...this.blankForm(), displayOrder: maxOrder + 1 };
    this.editorOpen = true;
  }

  openEdit(row: Row): void {
    this.editing = row;
    this.form = {
      id: row.id,
      name: row.name || '',
      displayOrder: row.displayOrder || 1,
      defaultMaxMarks: row.defaultMaxMarks ?? null,
      description: row.description || '',
    };
    this.editorOpen = true;
  }

  closeEditor(): void {
    if (this.isSaving) return;
    this.editorOpen = false;
    this.editing = null;
  }

  save(): void {
    const name = (this.form.name || '').trim();
    if (!name) {
      this.snackBar.open('Name is required', 'Close', { duration: 2500 });
      return;
    }
    this.isSaving = true;
    const payload: any = {
      name,
      displayOrder: Number(this.form.displayOrder) || 1,
      defaultMaxMarks: this.form.defaultMaxMarks == null || this.form.defaultMaxMarks === ('' as any)
        ? null
        : Number(this.form.defaultMaxMarks),
      description: (this.form.description || '').trim() || null,
    };
    const req$ = this.editing?.id
      ? this.api.updateExamType(this.editing.id, payload)
      : this.api.createExamType(payload);
    req$.subscribe({
      next: () => {
        this.isSaving = false;
        this.editorOpen = false;
        this.editing = null;
        this.snackBar.open('Saved', 'Close', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save', 'Close', { duration: 4000 });
      },
    });
  }

  archive(row: Row): void {
    if (!row.id) return;
    this.api.archiveExamType(row.id).subscribe({
      next: () => { this.snackBar.open('Archived', 'Close', { duration: 2500 }); this.load(); },
      error: () => this.snackBar.open('Failed to archive', 'Close', { duration: 3000 }),
    });
  }

  restore(row: Row): void {
    if (!row.id) return;
    this.api.restoreExamType(row.id).subscribe({
      next: () => { this.snackBar.open('Restored', 'Close', { duration: 2500 }); this.load(); },
      error: () => this.snackBar.open('Failed to restore', 'Close', { duration: 3000 }),
    });
  }

  // ── Delete flow (uses the shared global .delete-overlay / .delete-dialog styles) ──
  remove(row: Row): void {
    if (!row?.id) return;
    this.rowToDelete = row;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    if (this.isDeleting) return;
    this.deleteDialogOpen = false;
    this.rowToDelete = null;
  }

  confirmDelete(): void {
    const row = this.rowToDelete;
    if (!row?.id) return;
    this.isDeleting = true;
    this.api.deleteExamType(row.id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.deleteDialogOpen = false;
        this.rowToDelete = null;
        this.snackBar.open(`Deleted "${row.name}"`, 'Close', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.isDeleting = false;
        this.snackBar.open(err?.error?.message || 'Failed to delete', 'Close', { duration: 5000 });
      },
    });
  }
}
