import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../../core/services/api.service';
import { LeaveType, UpsertLeaveTypeRequest } from '../../../../../core/models';

interface DialogData {
  mode: 'create' | 'edit';
  type?: LeaveType;
}

/**
 * Full-policy Leave Type editor. Four tabs of form fields grouped by
 * concept — Basics, Balance, Rules, Applicability — so HR doesn't
 * confront the whole schema on one page. Every field surfaces a
 * one-line hint under it so a new-to-the-app HR user knows what
 * choosing "Monthly accrual" actually means in practice.
 *
 * <p>Save button is grouped under the tab strip (not per-tab) —
 * MatDialog convention, avoids a per-tab save button that would
 * confuse "did I save the other tabs?".</p>
 */
@Component({
  selector: 'app-leave-type-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatSelectModule, MatSlideToggleModule, MatProgressSpinnerModule,
    MatTabsModule, MatTooltipModule, MatSnackBarModule,
  ],
  templateUrl: './leave-type-dialog.component.html',
  styleUrl: './leave-type-dialog.component.scss',
})
export class LeaveTypeDialogComponent {

  form: {
    code: string;
    name: string;
    description: string;
    color: string;
    defaultAnnualQuota: number;
    paid: boolean;
    sortOrder: number;
    carryForward: boolean;
    carryForwardMax: number;
    accrualType: 'YEARLY' | 'MONTHLY' | 'QUARTERLY';
    minAdvanceDays: number;
    maxConsecutiveDays: number;
    requiresAttachmentAfterDays: number;
    applicableGender: 'ANY' | 'MALE' | 'FEMALE';
    mandatoryPerYear: number;
  } = {
    code: '',
    name: '',
    description: '',
    color: '#3b82f6',
    defaultAnnualQuota: 0,
    paid: true,
    sortOrder: 500,
    carryForward: false,
    carryForwardMax: 0,
    accrualType: 'YEARLY',
    minAdvanceDays: 0,
    maxConsecutiveDays: 0,
    requiresAttachmentAfterDays: 0,
    applicableGender: 'ANY',
    mandatoryPerYear: 0,
  };

  /** Curated palette shown as swatches so HR picks a color from the
   *  brand-safe set rather than typing arbitrary hex. Order matches
   *  the Tailwind default palette so the codes are familiar. */
  readonly colorSwatches = [
    '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#a855f7', '#ec4899', '#64748b',
  ];

  isSaving = false;

  constructor(
    private ref: MatDialogRef<LeaveTypeDialogComponent, boolean>,
    private api: ApiService,
    private snack: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    if (data.mode === 'edit' && data.type) {
      const t = data.type;
      this.form.code = t.code;
      this.form.name = t.name;
      this.form.description = t.description || '';
      this.form.color = t.color || '#3b82f6';
      this.form.defaultAnnualQuota = t.defaultAnnualQuota;
      this.form.paid = t.paid;
      this.form.sortOrder = t.sortOrder;
      this.form.carryForward = t.carryForward;
      this.form.carryForwardMax = t.carryForwardMax;
      this.form.accrualType = t.accrualType;
      this.form.minAdvanceDays = t.minAdvanceDays;
      this.form.maxConsecutiveDays = t.maxConsecutiveDays;
      this.form.requiresAttachmentAfterDays = t.requiresAttachmentAfterDays;
      this.form.applicableGender = t.applicableGender;
      this.form.mandatoryPerYear = t.mandatoryPerYear;
    }
  }

  get isEdit(): boolean { return this.data.mode === 'edit'; }

  pickColor(c: string): void { this.form.color = c; }

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
      description: this.form.description.trim() || undefined,
      color: this.form.color,
      defaultAnnualQuota: Number(this.form.defaultAnnualQuota) || 0,
      paid: this.form.paid,
      sortOrder: Number(this.form.sortOrder) || 500,
      carryForward: this.form.carryForward,
      carryForwardMax: Number(this.form.carryForwardMax) || 0,
      accrualType: this.form.accrualType,
      minAdvanceDays: Number(this.form.minAdvanceDays) || 0,
      maxConsecutiveDays: Number(this.form.maxConsecutiveDays) || 0,
      requiresAttachmentAfterDays: Number(this.form.requiresAttachmentAfterDays) || 0,
      applicableGender: this.form.applicableGender,
      mandatoryPerYear: Number(this.form.mandatoryPerYear) || 0,
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
