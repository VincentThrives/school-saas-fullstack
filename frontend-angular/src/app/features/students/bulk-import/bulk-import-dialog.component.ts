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
  /** UI state machine — picks which card / report to render.
   *  'success' is the post-import state that keeps the dialog open
   *  with the import counts + an "Import another file" reset button,
   *  instead of closing immediately. Earlier behaviour closed the
   *  dialog right after a successful upload, which made it look like
   *  the screen "got stuck" if the admin wanted to import a second
   *  file (e.g. another class) — they had to click Bulk Import again
   *  from the parent page.
   */
  state: 'idle' | 'downloading' | 'picking' | 'uploading' | 'errors' | 'success' = 'idle';
  selectedFile: File | null = null;
  errorReport: StudentImportErrorReport | null = null;
  importResult: StudentImportResult | null = null;
  /** True once at least one successful import has happened in this
   *  dialog instance — flips the cancel button label to "Done" and
   *  tells the parent to refresh on close. */
  hadSuccessfulImport = false;
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
        this.hadSuccessfulImport = true;
        // Flip into the success view — the admin can read the counts,
        // then either close (refreshes the parent list) or click
        // "Import another file" to upload a different batch without
        // re-opening the dialog. Selected file is kept on screen for
        // confirmation but cleared from state so the next pick starts
        // fresh.
        this.state = 'success';
        this.errorReport = null;
        const created = this.importResult?.created ?? 0;
        this.snackBar.open(`Imported ${created} student${created === 1 ? '' : 's'}.`, 'Close',
                           { duration: 5000 });
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
    // Pass true when at least one import succeeded in this session so
    // the parent students-list refreshes. Plain Close (no imports yet)
    // returns false and the parent skips the refresh.
    this.dialogRef.close(this.hadSuccessfulImport);
  }

  /**
   * Reset to the picking state so the admin can upload another file
   * without closing + re-opening the dialog. Useful when importing
   * multiple classes / sections in one session. The "had successful
   * import" flag stays true so the close button still triggers a
   * parent refresh.
   */
  importAnotherFile(): void {
    this.state = 'idle';
    this.selectedFile = null;
    this.errorReport = null;
    this.importResult = null;
    // autoGrowCapacity intentionally kept — the admin probably wants
    // the same setting for the next file.
  }
}
