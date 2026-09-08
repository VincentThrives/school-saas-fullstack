import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../../core/services/api.service';
import { LeaveType, UpsertLeaveTypeRequest } from '../../../../../core/models';

interface DialogData {
  mode: 'create' | 'edit';
  type?: LeaveType;
}

/**
 * Shared create + edit dialog for leave types. Code is only editable
 * on create (matches the backend which treats code as immutable).
 * Everything else is editable in both modes.
 */
@Component({
  selector: 'app-leave-type-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  templateUrl: './leave-type-dialog.component.html',
  styleUrl: './leave-type-dialog.component.scss',
})
export class LeaveTypeDialogComponent {

  form: UpsertLeaveTypeRequest & { code: string; name: string; defaultAnnualQuota: number; paid: boolean; sortOrder: number } = {
    code: '',
    name: '',
    defaultAnnualQuota: 0,
    paid: true,
    sortOrder: 500,
  };
  isSaving = false;

  constructor(
    private ref: MatDialogRef<LeaveTypeDialogComponent, boolean>,
    private api: ApiService,
    private snack: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    if (data.mode === 'edit' && data.type) {
      this.form.code = data.type.code;
      this.form.name = data.type.name;
      this.form.defaultAnnualQuota = data.type.defaultAnnualQuota;
      this.form.paid = data.type.paid;
      this.form.sortOrder = data.type.sortOrder;
    }
  }

  get isEdit(): boolean { return this.data.mode === 'edit'; }

  submit(): void {
    if (this.isSaving) return;
    if (!this.form.code?.trim()) return this.snackErr('Code is required.');
    if (!this.form.name?.trim()) return this.snackErr('Name is required.');

    const code = this.form.code.trim().toUpperCase();
    if (!this.isEdit && (code.length < 2 || code.length > 8)) {
      return this.snackErr('Code must be 2–8 characters.');
    }

    const payload: UpsertLeaveTypeRequest = {
      code: this.isEdit ? undefined : code,
      name: this.form.name.trim(),
      defaultAnnualQuota: Number(this.form.defaultAnnualQuota) || 0,
      paid: this.form.paid,
      sortOrder: Number(this.form.sortOrder) || 500,
    };

    this.isSaving = true;
    const call$ = this.isEdit && this.data.type
      ? this.api.hrUpdateLeaveType(this.data.type.id, payload)
      : this.api.hrCreateLeaveType(payload);
    call$.subscribe({
      next: () => {
        this.isSaving = false;
        this.snack.open(this.isEdit ? 'Leave type updated.' : 'Leave type created.',
          'Close', { duration: 3000 });
        this.ref.close(true);
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(err?.error?.message || 'Save failed.', 'Close', { duration: 4500 });
      },
    });
  }

  cancel(): void { this.ref.close(false); }

  private snackErr(msg: string): void {
    this.snack.open(msg, 'Close', { duration: 3500 });
  }
}
