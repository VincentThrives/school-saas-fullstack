import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import {
  EmployeeAttendance, RegularizationRequest,
} from '../../../../../core/models';

/**
 * Read-only day-details popup for a calendar cell tap. Shows
 * whatever data we have for the picked date — the attendance row
 * (IN / OUT / duration / status / source) if it exists, plus any
 * regularization request the employee submitted for that day.
 *
 * <p>Purpose: give employees a one-tap-away view of "what does the
 * system actually think happened on this day?" without navigating
 * away from the calendar. Especially useful for regularized days
 * where they want to see who approved it and what note HR left.</p>
 */
@Component({
  selector: 'app-day-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule, MatDialogModule,
  ],
  templateUrl: './day-details-dialog.component.html',
  styleUrl: './day-details-dialog.component.scss',
})
export class DayDetailsDialogComponent {

  constructor(
    private ref: MatDialogRef<DayDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      dateIso: string;
      row?: EmployeeAttendance;
      request?: RegularizationRequest;
      isWeekOff?: boolean;
      isFuture?: boolean;
    },
  ) {}

  close(): void { this.ref.close(); }

  get dateLabel(): string {
    return new Date(this.data.dateIso).toLocaleDateString('en-IN',
      { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  /** Duration between IN and OUT — formatted as "Hh Mm". Handles
   *  the "OUT is before IN" case (usually an AM/PM typo on the
   *  regularization request) by flagging it explicitly instead of
   *  quietly returning "—". */
  get duration(): string {
    const inT = this.data.row?.inTime;
    const outT = this.data.row?.outTime;
    if (!inT || !outT) return '—';
    const ms = new Date(outT).getTime() - new Date(inT).getTime();
    if (ms < 0) return 'Invalid — OUT before IN';
    if (ms === 0) return '0m';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  /** True when OUT is before IN — drives a warning tint on the
   *  duration tile so employees notice the bad data. */
  get isDurationInvalid(): boolean {
    const inT = this.data.row?.inTime;
    const outT = this.data.row?.outTime;
    if (!inT || !outT) return false;
    return new Date(outT).getTime() < new Date(inT).getTime();
  }

  /** Where the row came from — human-friendly copy. */
  get sourceLabel(): string {
    switch (this.data.row?.source) {
      case 'LOCATION':       return 'Location — phone GPS';
      case 'BIOMETRIC':      return 'Biometric terminal';
      case 'MANUAL':         return 'HR marked manually';
      case 'REGULARIZATION': return 'Regularization approved';
      default:               return '—';
    }
  }

  get sourceIcon(): string {
    switch (this.data.row?.source) {
      case 'LOCATION':       return 'location_on';
      case 'BIOMETRIC':      return 'fingerprint';
      case 'MANUAL':         return 'edit';
      case 'REGULARIZATION': return 'assignment_turned_in';
      default:               return 'help_outline';
    }
  }

  requestStatusLabel(status?: string): string {
    switch (status) {
      case 'PENDING':        return 'Pending HR review';
      case 'AUTO_APPROVED':  return 'Auto-approved';
      case 'APPROVED':       return 'Approved';
      case 'REJECTED':       return 'Rejected';
      default:               return status || '—';
    }
  }

  requestStatusClass(status?: string): string {
    switch (status) {
      case 'PENDING':        return 'req-status--pending';
      case 'AUTO_APPROVED':
      case 'APPROVED':       return 'req-status--approved';
      case 'REJECTED':       return 'req-status--rejected';
      default:               return '';
    }
  }

  formatTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN',
      { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDateTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  /** Which "empty state" copy to show when we have literally nothing
   *  for the day — future days, week-offs, or plain no-data days
   *  each get a distinct message. */
  get emptyStateCopy(): { icon: string; title: string; body: string } | null {
    if (this.data.row || this.data.request) return null;
    if (this.data.isFuture) return {
      icon: 'schedule',
      title: 'Future date',
      body: 'This day hasn\'t happened yet.',
    };
    if (this.data.isWeekOff) return {
      icon: 'weekend',
      title: 'Week off',
      body: 'No attendance expected on this day.',
    };
    return {
      icon: 'event_busy',
      title: 'No attendance data',
      body: 'You didn\'t punch on this day. Submit a regularization from the '
          + 'Regularization tab if this should be corrected.',
    };
  }
}
