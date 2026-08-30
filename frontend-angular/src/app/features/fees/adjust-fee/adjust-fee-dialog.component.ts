import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import {
  StudentFeeLedger,
  AdjustFeeRequest,
  SURCHARGE_REASONS,
  CONCESSION_REASONS,
} from '../../../core/models';

interface DialogData {
  ledger: StudentFeeLedger;
}

/**
 * "Adjust Fee" dialog for one student's ledger — sets an optional
 * surcharge (extra on top of class default) and/or an optional
 * concession (discount), each with a fixed-dropdown reason so the
 * audit trail stays clean. Total payable auto-recalculates as the
 * admin types.
 */
@Component({
  selector: 'app-adjust-fee-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  templateUrl: './adjust-fee-dialog.component.html',
  styleUrl: './adjust-fee-dialog.component.scss',
})
export class AdjustFeeDialogComponent {

  readonly surchargeReasons = SURCHARGE_REASONS;
  readonly concessionReasons = CONCESSION_REASONS;

  // Form state — seeded from the ledger so re-opening shows current
  // values (admin can then edit/clear).
  form: AdjustFeeRequest = {
    surcharge: 0,
    surchargeReason: '',
    concession: 0,
    concessionReason: '',
  };

  isSaving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<AdjustFeeDialogComponent, StudentFeeLedger | null>,
    private api: ApiService,
    private snack: MatSnackBar,
  ) {
    this.form = {
      surcharge: data.ledger.surcharge || 0,
      surchargeReason: data.ledger.surchargeReason || '',
      concession: data.ledger.concession || 0,
      concessionReason: data.ledger.concessionReason || '',
    };
  }

  /** Live-updating "what will the new total payable be?" — shown at
   *  the bottom of the dialog so admin sees the impact before saving. */
  get previewTotalPayable(): number {
    const s = Number(this.form.surcharge) || 0;
    const c = Number(this.form.concession) || 0;
    return (this.data.ledger.totalFee || 0) + s - c;
  }

  /** Save disabled unless: numbers are non-negative AND a reason is
   *  picked whenever the paired amount is > 0. Guards the audit trail. */
  get canSave(): boolean {
    const s = Number(this.form.surcharge);
    const c = Number(this.form.concession);
    if (Number.isNaN(s) || Number.isNaN(c) || s < 0 || c < 0) return false;
    if (s > 0 && !this.form.surchargeReason) return false;
    if (c > 0 && !this.form.concessionReason) return false;
    return true;
  }

  save(): void {
    if (!this.canSave || this.isSaving) return;
    this.isSaving = true;
    const payload: AdjustFeeRequest = {
      surcharge: Number(this.form.surcharge) || 0,
      surchargeReason: (Number(this.form.surcharge) || 0) > 0 ? this.form.surchargeReason : undefined,
      concession: Number(this.form.concession) || 0,
      concessionReason: (Number(this.form.concession) || 0) > 0 ? this.form.concessionReason : undefined,
    };
    this.api.adjustFeeLedger(this.data.ledger.ledgerId, payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.snack.open('Fee adjusted', 'Close', { duration: 2500 });
        this.dialogRef.close(res?.data || null);
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.message || 'Failed to adjust fee';
        this.snack.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
