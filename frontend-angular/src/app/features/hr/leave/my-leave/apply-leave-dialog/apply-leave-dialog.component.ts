import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ApiService } from '../../../../../core/services/api.service';
import { LeaveBalance, LeaveType, SubmitLeaveRequest } from '../../../../../core/models';

/**
 * Employee-facing Apply Leave dialog.
 *
 * <p>Loads the tenant's active leave types + the employee's current-
 * year balances so the picker can show remaining days inline. When a
 * date range or half-day toggle changes, we recompute the requested-
 * days count so the user sees "you'll consume 2.5 days" before
 * submitting.</p>
 *
 * <p>Half-day rule: single-day requests only expose ONE half-day
 * toggle ("2nd half") — no "half + half = zero" trap. Multi-day
 * requests expose both.</p>
 */
@Component({
  selector: 'app-apply-leave-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatSnackBarModule, MatProgressSpinnerModule,
    MatDatepickerModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './apply-leave-dialog.component.html',
  styleUrl: './apply-leave-dialog.component.scss',
})
export class ApplyLeaveDialogComponent implements OnInit {

  types: LeaveType[] = [];
  balances: LeaveBalance[] = [];

  form: {
    leaveTypeCode: string;
    startDate: Date | null;
    endDate: Date | null;
    startHalf: boolean;
    endHalf: boolean;
    reason: string;
  } = {
    leaveTypeCode: '',
    startDate: null,
    endDate: null,
    startHalf: false,
    endHalf: false,
    reason: '',
  };

  isLoading = false;
  isSubmitting = false;

  constructor(
    private api: ApiService,
    private ref: MatDialogRef<ApplyLeaveDialogComponent, boolean>,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.api.hrActiveLeaveTypes().subscribe({
      next: (res) => {
        this.types = res.data || [];
        // Preselect the first type so users can hit Submit faster —
        // avoids the "why is Submit disabled?" moment when they've
        // typed everything else.
        if (this.types.length && !this.form.leaveTypeCode) {
          this.form.leaveTypeCode = this.types[0].code;
        }
      },
      error: () => {
        this.snack.open('Could not load leave types.', 'Close', { duration: 4000 });
      },
    });
    this.api.hrMyLeaveBalance().subscribe({
      next: (res) => { this.balances = res.data || []; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
  }

  balanceFor(code: string): LeaveBalance | undefined {
    return this.balances.find(b => b.leaveTypeCode === code);
  }

  /** True when the request is a single-day one, i.e., start = end.
   *  Drives the UI show/hide of the end-half checkbox — combining
   *  both halves on one day is a UX trap ("half day off + half day
   *  off = 0 leave? or full leave?"), so we hide it. */
  get isSingleDay(): boolean {
    if (!this.form.startDate || !this.form.endDate) return false;
    return this.sameDay(this.form.startDate, this.form.endDate);
  }

  /** Live estimate of leave days consumed — same math the server does. */
  get requestedDays(): number {
    if (!this.form.startDate || !this.form.endDate) return 0;
    const start = this.form.startDate;
    const end = this.form.endDate;
    if (end < start) return 0;
    const spanMs = end.getTime() - start.getTime();
    const spanned = Math.round(spanMs / 86400000) + 1;
    let d = spanned;
    if (this.form.startHalf) d -= 0.5;
    if (this.form.endHalf && !this.sameDay(start, end)) d -= 0.5;
    return Math.max(0, d);
  }

  get selectedType(): LeaveType | undefined {
    return this.types.find(t => t.code === this.form.leaveTypeCode);
  }

  get remainingAfter(): number | null {
    const b = this.balanceFor(this.form.leaveTypeCode);
    if (!b) return null;
    return b.remaining - this.requestedDays;
  }

  get insufficient(): boolean {
    const t = this.selectedType;
    if (!t) return false;
    if (t.defaultAnnualQuota <= 0) return false; // uncapped
    const after = this.remainingAfter;
    return after != null && after < 0;
  }

  submit(): void {
    if (this.isSubmitting) return;
    if (!this.form.leaveTypeCode) return this.snackErr('Pick a leave type.');
    if (!this.form.startDate) return this.snackErr('Start date is required.');
    if (!this.form.endDate) return this.snackErr('End date is required.');
    if (this.form.endDate < this.form.startDate) return this.snackErr('End date can\'t be before start date.');
    if (this.requestedDays <= 0) return this.snackErr('Requested duration is 0 days — check the half-day toggles.');
    if (!this.form.reason.trim()) return this.snackErr('Reason is required.');

    const payload: SubmitLeaveRequest = {
      leaveTypeCode: this.form.leaveTypeCode,
      startDate: this.toIso(this.form.startDate),
      endDate: this.toIso(this.form.endDate),
      startHalf: this.form.startHalf,
      endHalf: this.form.endHalf && !this.isSingleDay,
      reason: this.form.reason.trim(),
    };
    this.isSubmitting = true;
    this.api.hrApplyLeave(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.snack.open('Leave submitted. HR will review it shortly.',
          'Close', { duration: 3500 });
        this.ref.close(true);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snack.open(err?.error?.message || 'Failed to submit leave.',
          'Close', { duration: 5000 });
      },
    });
  }

  cancel(): void { this.ref.close(false); }

  // ── Helpers ────────────────────────────────────────────

  private snackErr(msg: string): void {
    this.snack.open(msg, 'Close', { duration: 3500 });
  }

  private sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
