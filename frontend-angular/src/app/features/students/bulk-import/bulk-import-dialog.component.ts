import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ApiService, StudentImportErrorReport, StudentImportResult } from '../../../core/services/api.service';

interface DialogData {
  academicYearId: string;
  academicYearLabel?: string;
}

@Component({
  selector: 'app-bulk-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatSnackBarModule,
  ],
  templateUrl: './bulk-import-dialog.component.html',
  styleUrl: './bulk-import-dialog.component.scss',
})
export class BulkImportDialogComponent {
  /** UI state machine — picks which card / report to render. */
  state: 'idle' | 'downloading' | 'picking' | 'uploading' | 'errors' = 'idle';
  selectedFile: File | null = null;
  errorReport: StudentImportErrorReport | null = null;
  importResult: StudentImportResult | null = null;
  /** When ticked, backend bumps section capacity to fit instead of failing
   *  the upload. Off by default — keeps mid-year imports safe from
   *  accidentally growing sections. */
  autoGrowCapacity = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<BulkImportDialogComponent, boolean>,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  // ── Download template ─────────────────────────────────────────────

  downloadTemplate(): void {
    this.state = 'downloading';
    this.api.downloadStudentImportTemplate(this.data.academicYearId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students-import-template.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.state = 'idle';
        this.snackBar.open('Template downloaded — fill it and upload here.', 'Close', { duration: 4000 });
      },
      error: () => {
        this.state = 'idle';
        this.snackBar.open('Failed to download template.', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Pick & upload ─────────────────────────────────────────────────

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
    // Clear any previous error report — re-uploading a new file starts fresh.
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

    this.api.bulkImportStudents(this.selectedFile, this.data.academicYearId, this.autoGrowCapacity).subscribe({
      next: (res) => {
        this.importResult = res?.data || null;
        this.state = 'idle';
        const created = this.importResult?.created ?? 0;
        this.snackBar.open(`Imported ${created} student${created === 1 ? '' : 's'}.`, 'Close',
                           { duration: 5000 });
        // Close + signal caller to refresh the list.
        this.dialogRef.close(true);
      },
      error: (err) => {
        // Backend returns 400 with the StudentImportErrorReport in err.error.data.
        // The report can carry row errors, capacity issues, or both.
        const report = err?.error?.data as StudentImportErrorReport | undefined;
        const hasRowErrors = !!(report?.errors && report.errors.length > 0);
        const hasCapacityIssues = !!(report?.capacityIssues && report.capacityIssues.length > 0);
        if (report && (hasRowErrors || hasCapacityIssues)) {
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
    this.dialogRef.close(false);
  }
}
