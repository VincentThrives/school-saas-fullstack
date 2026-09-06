import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { ApiService } from '../../../../../core/services/api.service';
import {
  EmployeeAttendanceSettings, RegularizationRequest,
} from '../../../../../core/models';

/**
 * HR-side approve/reject dialog for a regularization request.
 * Replaces the old {@code window.prompt()} approach so HR sees the
 * full context — employee name + claimed times + reason + the
 * auto-computed status the request would land as (based on the
 * tenant's late / half-day rules) — before committing.
 *
 * <p>Also lets HR override the computed status. Common case: the
 * claimed times imply HALF_DAY but HR knows the employee was on
 * an approved short-shift for a valid reason and wants PRESENT
 * stamped. Override is passed through as {@code overrideStatus}
 * in the returned payload; backend still applies the underlying
 * time rule when null.</p>
 *
 * <p>Surfaces "invalid duration" (OUT before IN — usually AM/PM
 * typo on the employee's side) as a red banner so HR notices
 * before stamping something incorrect.</p>
 */
@Component({
  selector: 'app-approval-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressSpinnerModule, MatDialogModule,
  ],
  templateUrl: './approval-dialog.component.html',
  styleUrl: './approval-dialog.component.scss',
})
export class ApprovalDialogComponent implements OnInit {

  /** 'approve' or 'reject' — flips the CTA + validation rules
   *  (rejection requires a note, approval doesn't). */
  mode: 'approve' | 'reject';
  notes: string = '';

  settings: EmployeeAttendanceSettings | null = null;
  isLoadingSettings = false;

  constructor(
    private api: ApiService,
    private ref: MatDialogRef<ApprovalDialogComponent,
      { action: 'approve' | 'reject'; notes: string } | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: {
      request: RegularizationRequest;
      mode: 'approve' | 'reject';
    },
  ) {
    this.mode = data.mode;
  }

  ngOnInit(): void {
    // Load tenant settings so we can show HR what the auto-computed
    // status would be (late threshold + half-day hours drive it).
    this.isLoadingSettings = true;
    this.api.hrGetAttendanceSettings().subscribe({
      next: (res) => { this.settings = res.data as EmployeeAttendanceSettings; this.isLoadingSettings = false; },
      error: () => { this.isLoadingSettings = false; },
    });
  }

  // ── Derived: duration + auto-computed status preview ─────

  /** Duration between claimed IN and OUT in minutes. Negative when
   *  OUT is before IN (usually an AM/PM typo — surfaced as a
   *  warning banner in the template). */
  get durationMinutes(): number | null {
    const inT = this.data.request.claimedInTime;
    const outT = this.data.request.claimedOutTime;
    if (!inT || !outT) return null;
    return Math.floor((new Date(outT).getTime() - new Date(inT).getTime()) / 60_000);
  }

  get durationLabel(): string {
    const m = this.durationMinutes;
    if (m == null) return '—';
    if (m < 0) return `Invalid (OUT is ${Math.abs(m)}m before IN)`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}m`;
    return `${h}h ${String(rem).padStart(2, '0')}m`;
  }

  get isDurationInvalid(): boolean {
    const m = this.durationMinutes;
    return m != null && m < 0;
  }

  /** Auto-computed status preview — mirrors backend
   *  {@code applyHalfDayRule} so HR sees what would land. Null
   *  when we can't compute (settings not loaded, missing IN, etc.). */
  get autoStatus(): 'PRESENT' | 'HALF_DAY' | null {
    if (!this.settings || !this.data.request.claimedInTime) return null;
    if (this.durationMinutes == null || this.durationMinutes < 0) return null;
    if (!this.settings.halfDayCalculationEnabled) return 'PRESENT';
    const hoursWorked = this.durationMinutes / 60;
    return hoursWorked < this.settings.halfDayMaxHours ? 'HALF_DAY' : 'PRESENT';
  }

  /** True when the claimed IN is at/after the late threshold —
   *  drives the "will be flagged Late" chip. */
  get willBeLate(): boolean {
    if (!this.settings || !this.data.request.claimedInTime) return false;
    try {
      const inLocal = new Date(this.data.request.claimedInTime);
      const [lh, lm] = (this.settings.lateThreshold || '09:15').split(':').map(Number);
      const late = new Date(inLocal);
      late.setHours(lh, lm, 0, 0);
      return inLocal.getTime() >= late.getTime();
    } catch { return false; }
  }

  // ── Actions ─────────────────────────────────

  submit(): void {
    // Rejection requires a note (matches the earlier prompt-based
    // behaviour — an unexplained rejection is a bad employee UX).
    if (this.mode === 'reject' && !this.notes.trim()) {
      return;
    }
    this.ref.close({
      action: this.mode,
      notes: this.notes.trim(),
    });
  }

  close(): void { this.ref.close(); }

  // ── Formatters ──────────────────────────────

  formatTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN',
      { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN',
      { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
}
