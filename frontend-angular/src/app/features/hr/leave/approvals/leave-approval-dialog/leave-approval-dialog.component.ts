import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LeaveApplication } from '../../../../../core/models';

interface DialogData {
  leave: LeaveApplication;
  mode: 'approve' | 'reject';
}

/**
 * Shared HR-review dialog for both approve and reject flows. Shows a
 * summary of the leave the HR admin is deciding on, a notes textarea
 * (required on reject, optional on approve), and hits Done to
 * return the notes to the parent list which then fires the actual
 * approve / reject API call.
 */
@Component({
  selector: 'app-leave-approval-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './leave-approval-dialog.component.html',
  styleUrl: './leave-approval-dialog.component.scss',
})
export class LeaveApprovalDialogComponent {

  notes = '';

  constructor(
    private ref: MatDialogRef<LeaveApprovalDialogComponent, { notes?: string } | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  get isApprove(): boolean { return this.data.mode === 'approve'; }

  get canConfirm(): boolean {
    if (this.isApprove) return true;
    return this.notes.trim().length > 0;
  }

  confirm(): void {
    if (!this.canConfirm) return;
    this.ref.close({ notes: this.notes.trim() || undefined });
  }

  cancel(): void { this.ref.close(); }

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
    const s = row.startHalf ? ' (half)' : '';
    const e = row.endHalf ? ' (half)' : '';
    return `${this.formatDate(row.startDate)}${s} → ${this.formatDate(row.endDate)}${e}`;
  }
}
