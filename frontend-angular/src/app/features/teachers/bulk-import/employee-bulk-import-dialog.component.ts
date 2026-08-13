import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  ApiService,
  EmployeeImportErrorReport,
  EmployeeImportResult,
} from '../../../core/services/api.service';

/**
 * Bulk-import dialog for the Employees page. Mirrors the student
 * bulk-import UX so the two feel like the same product surface — same
 * download-template first, same all-or-nothing upload, same success /
 * error state machine.
 */
@Component({
  selector: 'app-employee-bulk-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './employee-bulk-import-dialog.component.html',
  styleUrl: './employee-bulk-import-dialog.component.scss',
})
export class EmployeeBulkImportDialogComponent {
  /** UI state machine. `success` keeps the dialog open after a good
   *  upload so the admin can read the counts and optionally import a
   *  second file without re-opening the dialog. */
  state: 'idle' | 'downloading' | 'picking' | 'uploading' | 'errors' | 'success' = 'idle';
  selectedFile: File | null = null;
  errorReport: EmployeeImportErrorReport | null = null;
  importResult: EmployeeImportResult | null = null;
  /** True once at least one successful import happened in this dialog
   *  instance — flips the close button to trigger a parent refresh. */
  hadSuccessfulImport = false;

  constructor(
    private dialogRef: MatDialogRef<EmployeeBulkImportDialogComponent, boolean>,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  // ── Download template ───────────────────────────────────────────

  downloadTemplate(): void {
    this.state = 'downloading';
    this.api.downloadEmployeeImportTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employees-import-template.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.state = 'idle';
        this.snackBar.open('Template downloaded — fill it and upload here.',
          'Close', { duration: 4000 });
      },
      error: () => {
        this.state = 'idle';
        this.snackBar.open('Failed to download template.', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Pick & upload ───────────────────────────────────────────────

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.snackBar.open('Please pick a .xlsx file.', 'Close', { duration: 3000 });
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.snackBar.open('File too large — keep it under 10 MB.', 'Close', { duration: 3000 });
      input.value = '';
      return;
    }
    this.selectedFile = file;
    this.state = 'picking';
    this.errorReport = null;
  }

  clearFile(): void {
    this.selectedFile = null;
    this.errorReport = null;
    this.state = 'idle';
  }

  upload(): void {
    if (!this.selectedFile) return;
    this.state = 'uploading';
    this.errorReport = null;

    this.api.bulkImportEmployees(this.selectedFile).subscribe({
      next: (res) => {
        this.importResult = res?.data || null;
        this.hadSuccessfulImport = true;
        this.state = 'success';
        this.errorReport = null;
        const created = this.importResult?.created ?? 0;
        this.snackBar.open(
          `Imported ${created} employee${created === 1 ? '' : 's'}.`,
          'Close', { duration: 5000 });
      },
      error: (err) => {
        // Backend returns 400 with the EmployeeImportErrorReport in err.error.data
        // when any row fails validation.
        const report = err?.error?.data as EmployeeImportErrorReport | undefined;
        if (report && report.errors && report.errors.length > 0) {
          this.errorReport = report;
          this.state = 'errors';
        } else {
          this.state = 'picking';
          this.snackBar.open(
            err?.error?.message || 'Import failed — please check the file and try again.',
            'Close', { duration: 4000 });
        }
      },
    });
  }

  cancel(): void {
    // Pass true when at least one import succeeded so the parent
    // employees list refreshes on close. Plain Close (no successful
    // imports) returns false and the parent skips the refresh.
    this.dialogRef.close(this.hadSuccessfulImport);
  }

  /** Reset to the picking state so the admin can upload another file
   *  without closing + re-opening the dialog. */
  importAnotherFile(): void {
    this.state = 'idle';
    this.selectedFile = null;
    this.errorReport = null;
    this.importResult = null;
  }
}
