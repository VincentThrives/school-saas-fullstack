import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../../core/services/api.service';
import { LeaveBalance, OverrideBalanceRequest } from '../../../../../core/models';

interface DialogData {
  employeeId: string;
  employeeName: string;
  academicYearId: string;
  academicYearLabel: string;
  balance: LeaveBalance;
}

/**
 * HR override dialog — bumps one employee's allocation / carry-in /
 * used counter for a specific (year, type). Loaded from the Balances
 * page tile; result triggers a reload.
 *
 * <p>Live-preview shows what "remaining" will read after save so HR
 * doesn't have to do the arithmetic in their head.</p>
 */
@Component({
  selector: 'app-override-balance-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  templateUrl: './override-balance-dialog.component.html',
  styleUrl: './override-balance-dialog.component.scss',
})
export class OverrideBalanceDialogComponent {

  form: { allocated: number; carryForwardIn: number; used: number } = {
    allocated: 0,
    carryForwardIn: 0,
    used: 0,
  };

  isSaving = false;

  constructor(
    private ref: MatDialogRef<OverrideBalanceDialogComponent, boolean>,
    private api: ApiService,
    private snack: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    this.form.allocated = data.balance.allocated;
    this.form.carryForwardIn = data.balance.carryForwardIn;
    this.form.used = data.balance.used;
  }

  get liveRemaining(): number {
    const val = (Number(this.form.allocated) || 0)
      + (Number(this.form.carryForwardIn) || 0)
      - (Number(this.form.used) || 0);
    return Number(val.toFixed(2));
  }

  get changed(): boolean {
    return this.form.allocated !== this.data.balance.allocated
        || this.form.carryForwardIn !== this.data.balance.carryForwardIn
        || this.form.used !== this.data.balance.used;
  }

  submit(): void {
    if (this.isSaving || !this.changed) return;
    const payload: OverrideBalanceRequest = {
      allocated: Number(this.form.allocated) || 0,
      carryForwardIn: Number(this.form.carryForwardIn) || 0,
      used: Number(this.form.used) || 0,
    };
    this.isSaving = true;
    this.api.hrOverrideLeaveBalance(
      this.data.employeeId,
      this.data.balance.leaveTypeCode,
      payload,
      this.data.academicYearId,
    ).subscribe({
      next: () => {
        this.isSaving = false;
        this.snack.open('Balance updated.', 'Close', { duration: 3000 });
        this.ref.close(true);
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(err?.error?.message || 'Update failed.', 'Close', { duration: 4500 });
      },
    });
  }

  cancel(): void { this.ref.close(false); }
}
