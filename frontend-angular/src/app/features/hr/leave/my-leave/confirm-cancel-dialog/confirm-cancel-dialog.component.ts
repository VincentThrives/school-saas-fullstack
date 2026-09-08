import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LeaveApplication } from '../../../../../core/models';

interface DialogData {
  leave: LeaveApplication;
}

/**
 * Small confirm dialog for the "Cancel this leave?" flow on the My
 * Leave page. Replaces the browser {@code confirm()} alert — matches
 * the visual style of the rest of the leave module dialogs (icon +
 * title + summary card + primary/secondary buttons) and shows a bit
 * of context so the employee doesn't cancel the wrong row from a
 * long history list.
 */
@Component({
  selector: 'app-confirm-cancel-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-cancel-dialog.component.html',
  styleUrl: './confirm-cancel-dialog.component.scss',
})
export class ConfirmCancelDialogComponent {
  constructor(
    private ref: MatDialogRef<ConfirmCancelDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  confirm(): void { this.ref.close(true); }
  keep(): void { this.ref.close(false); }

  formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatRange(row: LeaveApplication): string {
    if (row.startDate === row.endDate) {
      const suffix = row.startHalf ? ' (half-day)' : '';
      return this.formatDate(row.startDate) + suffix;
    }
    return `${this.formatDate(row.startDate)} → ${this.formatDate(row.endDate)}`;
  }

  /** Approved-in-future leaves refund the balance; PENDING leaves
   *  had nothing deducted yet. Show the right message so the user
   *  knows what happens to their balance. */
  get willRefundBalance(): boolean {
    return this.data.leave.status === 'APPROVED';
  }
}
