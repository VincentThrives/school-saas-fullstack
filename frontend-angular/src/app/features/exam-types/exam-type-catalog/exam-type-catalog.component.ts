import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';

interface TypeRow {
  id?: string;
  name: string;
  key?: string;
  color?: string;
  displayOrder: number;
  description?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}

@Component({
  selector: 'app-exam-type-catalog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatTooltipModule, MatChipsModule,
    MatDialogModule, MatSnackBarModule,
  ],
  templateUrl: './exam-type-catalog.component.html',
  styleUrl: './exam-type-catalog.component.scss',
})
export class ExamTypeCatalogComponent implements OnInit {
  @ViewChild('editorTpl', { static: true }) editorTpl!: TemplateRef<any>;

  rows: TypeRow[] = [];
  isLoading = false;
  showArchived = false;
  isSaving = false;

  form: TypeRow = this.blankForm();
  editing: TypeRow | null = null;
  private dialogRef?: MatDialogRef<any>;

  displayedColumns = ['color', 'name', 'key', 'displayOrder', 'description', 'status', 'actions'];

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading = true;
    this.api.getExamTypes(this.showArchived).subscribe({
      next: (res: any) => {
        this.rows = (res?.data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          key: r.key,
          color: r.color,
          displayOrder: r.displayOrder,
          description: r.description,
          status: r.status,
        }));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam types', 'Close', { duration: 3000 });
      },
    });
  }

  onToggleArchived(): void { this.load(); }

  blankForm(): TypeRow {
    return { name: '', key: '', color: '#6b7280', displayOrder: 1, description: '' };
  }

  openCreate(): void {
    this.editing = null;
    const maxOrder = this.rows.reduce((m, r) => Math.max(m, r.displayOrder || 0), 0);
    this.form = { ...this.blankForm(), displayOrder: maxOrder + 1 };
    this.openDialog();
  }

  openEdit(row: TypeRow): void {
    this.editing = row;
    this.form = {
      id: row.id,
      name: row.name,
      key: row.key || '',
      color: row.color || '#6b7280',
      displayOrder: row.displayOrder,
      description: row.description || '',
    };
    this.openDialog();
  }

  private openDialog(): void {
    this.dialogRef = this.dialog.open(this.editorTpl, {
      width: '480px',
      maxWidth: '95vw',
      autoFocus: false,
      restoreFocus: true,
    });
  }

  close(): void {
    if (this.isSaving) return;
    this.dialogRef?.close();
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
      key: (this.form.key || '').trim() || null,
      color: this.form.color || null,
      displayOrder: Number(this.form.displayOrder) || 1,
      description: (this.form.description || '').trim() || null,
    };
    const req$ = this.editing?.id
      ? this.api.updateExamType(this.editing.id, payload)
      : this.api.createExamType(payload);
    req$.subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef?.close();
        this.snackBar.open('Saved', 'Close', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save', 'Close', { duration: 4000 });
      },
    });
  }

  archive(row: TypeRow): void {
    if (!row.id) return;
    this.api.archiveExamType(row.id).subscribe({
      next: () => { this.snackBar.open('Archived', 'Close', { duration: 2500 }); this.load(); },
      error: () => this.snackBar.open('Failed to archive', 'Close', { duration: 3000 }),
    });
  }

  restore(row: TypeRow): void {
    if (!row.id) return;
    this.api.restoreExamType(row.id).subscribe({
      next: () => { this.snackBar.open('Restored', 'Close', { duration: 2500 }); this.load(); },
      error: () => this.snackBar.open('Failed to restore', 'Close', { duration: 3000 }),
    });
  }

  remove(row: TypeRow): void {
    if (!row.id) return;
    this.api.deleteExamType(row.id).subscribe({
      next: () => { this.snackBar.open(`Deleted "${row.name}"`, 'Close', { duration: 2500 }); this.load(); },
      error: (err) => this.snackBar.open(err?.error?.message || 'Failed to delete', 'Close', { duration: 4000 }),
    });
  }
}
