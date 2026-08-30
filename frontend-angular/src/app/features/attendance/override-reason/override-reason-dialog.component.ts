import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

/** What the caller passes in — decides banner copy + which dropdown
 *  option list is offered.
 *
 *  <ul>
 *    <li>{@code dayType: 'HOLIDAY'} — the picked date is on the holidays
 *        list (Diwali, Republic Day, etc.). Dialog copy calls it out
 *        so the admin knows they're overriding a real closure.</li>
 *    <li>{@code dayType: 'NO_PERIODS'} — the timetable simply has no
 *        periods for this day-of-week (typical: Sunday on a Mon-Sat
 *        timetable). Less severe than a gazetted holiday.</li>
 *  </ul> */
interface DialogData {
  dayType: 'HOLIDAY' | 'NO_PERIODS';
  dayLabel: string;   // e.g. "Sunday" or "Diwali"
}

/** Return shape — dialog resolves to this on Save, or {@code null} on
 *  Cancel / backdrop click. The parent uses {@code null} to un-set
 *  the "Mark anyway" flag so the banner re-engages. */
export interface OverrideReasonResult {
  reason: string;      // canned reason label OR the "Other" custom text
  dayType: 'HOLIDAY' | 'NO_PERIODS';
}

/** Canned reasons — covers the common "why is school open on Sunday"
 *  cases in Indian schools. "Other" is always last as the escape hatch
 *  when none fit; picking Other reveals a free-text field required
 *  before Save enables. */
export const OVERRIDE_REASONS: readonly string[] = [
  'Makeup class',
  'Exam',
  'Sports event',
  'Cultural event',
  'Parent-teacher meeting',
  'Extra revision',
  'Special assembly',
  'Other',
];

/**
 * "Why are you marking attendance on this day?" dialog — opens when the
 * admin clicks "Mark attendance anyway" on the holiday / no-periods
 * banner. Stores the answer on the attendance record for the audit
 * trail AND surfaces it on the post-save summary card so revisiting the
 * day reads "Marked on Sunday — Makeup class" instead of a bare label.
 */
@Component({
  selector: 'app-override-reason-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  templateUrl: './override-reason-dialog.component.html',
  styleUrl: './override-reason-dialog.component.scss',
})
export class OverrideReasonDialogComponent {

  readonly reasons = OVERRIDE_REASONS;
  readonly OTHER = 'Other';

  selectedReason = '';
  otherText = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<OverrideReasonDialogComponent, OverrideReasonResult | null>,
  ) {}

  /** The banner headline changes by day-type so the admin isn't told
   *  they're overriding a "holiday" when it's really just a Sunday. */
  get headline(): string {
    return this.data.dayType === 'HOLIDAY'
      ? `Marking on a holiday (${this.data.dayLabel})`
      : `Marking on ${this.data.dayLabel} — no timetable for this day`;
  }

  /** Save disabled until the admin has picked something. When "Other"
   *  is picked, ALSO require a non-blank custom label so the audit
   *  trail can't end up with a bare "Other" with no context. */
  get canSave(): boolean {
    if (!this.selectedReason) return false;
    if (this.selectedReason === this.OTHER) {
      return !!this.otherText && this.otherText.trim().length > 0;
    }
    return true;
  }

  save(): void {
    if (!this.canSave) return;
    const reason = this.selectedReason === this.OTHER
      ? this.otherText.trim()
      : this.selectedReason;
    this.dialogRef.close({ reason, dayType: this.data.dayType });
  }

  cancel(): void { this.dialogRef.close(null); }
}
