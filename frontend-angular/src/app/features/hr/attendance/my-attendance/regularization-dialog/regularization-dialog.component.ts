import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { ApiService } from '../../../../../core/services/api.service';
import { SubmitRegularizationRequest } from '../../../../../core/models';

/**
 * Employee-facing dialog to submit a regularization request. Fills
 * in date + claimed IN / OUT + reason; backend enforces backdate,
 * monthly cap, and duplicate checks.
 *
 * <p>Auto-approve behaviour lives on the backend: if the claimed IN
 * time falls within the tenant's grace window of the late threshold,
 * the request lands as {@code AUTO_APPROVED} and the attendance row
 * is written immediately. The dialog only shows the API response
 * message which conveys either outcome to the user.</p>
 */
@Component({
  selector: 'app-regularization-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule,
    MatSelectModule, MatButtonToggleModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule,
  ],
  templateUrl: './regularization-dialog.component.html',
  styleUrl: './regularization-dialog.component.scss',
})
export class RegularizationDialogComponent {

  date: Date = new Date();
  today: Date = new Date();
  reason: string = '';

  isSaving = false;

  // ── 12-hour time picker state ─────────────────────
  // Three parts per time — Hour (1-12), Minute (0-55 in 5-min
  // steps), Meridiem (AM/PM). Kept as separate fields (rather
  // than one HH:mm string) so the template can bind to three
  // clean dropdowns / toggles and the user is never in doubt
  // about AM vs PM.
  inHour:     number | null = null;
  inMinute:   number | null = null;
  inMeridiem: 'AM' | 'PM' = 'AM';
  outHour:     number | null = null;
  outMinute:   number | null = null;
  outMeridiem: 'AM' | 'PM' = 'PM';   // default OUT to PM — the more common case

  readonly hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  // 5-minute steps — enough resolution for attendance without
  // making the dropdown a 60-item scroll.
  readonly minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  /** Compose the 24-hour "HH:mm" string from the three parts, or
   *  empty when the pair is incomplete. Used by the duration
   *  computation + the submit payload. */
  private compose12h(h: number | null, m: number | null, meridiem: 'AM' | 'PM'): string {
    if (h == null || m == null) return '';
    let hour24 = h % 12;
    if (meridiem === 'PM') hour24 += 12;
    return `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  get inTime(): string {
    return this.compose12h(this.inHour, this.inMinute, this.inMeridiem);
  }

  get outTime(): string {
    return this.compose12h(this.outHour, this.outMinute, this.outMeridiem);
  }

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private ref: MatDialogRef<RegularizationDialogComponent, boolean>,
  ) {}

  // ── Live validation helpers (bound in the template) ────

  /** Minutes between the picked IN and OUT times. Null when either
   *  is missing. Negative when OUT is before IN (the AM/PM typo
   *  case) — surfaced as a red inline error so the user fixes it
   *  before submitting instead of HR catching it downstream. */
  get durationMinutes(): number | null {
    if (!this.inTime || !this.outTime) return null;
    const parse = (s: string) => {
      const m = /^(\d{2}):(\d{2})$/.exec(s);
      return m ? +m[1] * 60 + +m[2] : NaN;
    };
    const a = parse(this.inTime);
    const b = parse(this.outTime);
    if (isNaN(a) || isNaN(b)) return null;
    return b - a;
  }

  get durationLabel(): string {
    const m = this.durationMinutes;
    if (m == null) return '';
    if (m < 0) return `OUT is ${Math.abs(m)}m before IN — did you mean PM?`;
    if (m === 0) return '0m — IN and OUT are the same';
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `Duration: ${rem}m`;
    return `Duration: ${h}h ${String(rem).padStart(2, '0')}m`;
  }

  get isDurationInvalid(): boolean {
    const m = this.durationMinutes;
    return m != null && m < 0;
  }

  save(): void {
    if (this.isSaving) return;
    if (!this.date) {
      this.snack.open('Pick a date.', 'Close', { duration: 2500 });
      return;
    }
    if (!this.inTime && !this.outTime) {
      this.snack.open('Fill in at least one of IN or OUT time.', 'Close', { duration: 3000 });
      return;
    }
    // Block invalid time pairs at source — this catches the AM/PM
    // typo case where users leave OUT as "02:30" meaning 2:30 PM
    // but browser interprets 24-hour = 2:30 AM. Better to error
    // here than let HR see a broken-duration request.
    if (this.isDurationInvalid) {
      this.snack.open(
        'OUT time is before IN time. Did you mean PM? Fix the times and try again.',
        'Close', { duration: 5000 });
      return;
    }
    if (!this.reason?.trim()) {
      this.snack.open('Please add a reason so HR can review.', 'Close', { duration: 3000 });
      return;
    }
    const req: SubmitRegularizationRequest = {
      date: this.toIsoDate(this.date),
      claimedInTime: this.hhmmToIso(this.inTime, this.date),
      claimedOutTime: this.hhmmToIso(this.outTime, this.date),
      reason: this.reason.trim(),
    };
    this.isSaving = true;
    this.api.hrSubmitRegularization(req).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.snack.open(res.message || 'Request submitted', 'Close', { duration: 4000 });
        this.ref.close(true);
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(
          err?.error?.message || 'Failed to submit request',
          'Close', { duration: 4500 });
      },
    });
  }

  close(): void {
    this.ref.close(false);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private hhmmToIso(hhmm: string, date: Date): string | undefined {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }
}
