import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import {
  EmployeeAttendance,
  PublicAttendanceSettings,
} from '../../../../core/models';

/**
 * Employee-facing "My Attendance" page.
 *
 * <p>Three states drive the top card:</p>
 * <ul>
 *   <li><b>Not marked today</b> — big "Mark IN" button, hint copy
 *       telling the employee they need to be within X metres of
 *       campus.</li>
 *   <li><b>IN only (2-punch tenants)</b> — "Mark OUT" button + a
 *       green pill showing when they came in.</li>
 *   <li><b>Both done (or 1-punch tenants after their punch)</b> —
 *       success card with times, no button.</li>
 * </ul>
 *
 * <p>Below the top card sits the current month's row history —
 * simple table with date, status chip, IN, OUT, source. No filters
 * (the list is at most 31 rows so scroll is enough).</p>
 *
 * <p>Not gated by any role — every authenticated user with a linked
 * employee record sees this. Backend {@code /my} endpoint returns an
 * empty list for users not linked to an employee, which surfaces the
 * "Not linked" empty state below.</p>
 */
@Component({
  selector: 'app-my-attendance',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatTableModule, MatTooltipModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  providers: [DatePipe],
  templateUrl: './my-attendance.component.html',
  styleUrl: './my-attendance.component.scss',
})
export class MyAttendanceComponent implements OnInit {

  settings: PublicAttendanceSettings | null = null;
  rows: EmployeeAttendance[] = [];
  today: EmployeeAttendance | null = null;

  isLoadingSettings = false;
  isLoadingRows = false;
  isMarking = false;

  /** ISO date "YYYY-MM-DD" — today in Asia/Kolkata. Snapshot at
   *  component init so the today lookup stays stable if the user
   *  leaves the page open past midnight. */
  todayIso = this.formatDateLocal(new Date());

  displayedCols = ['date', 'status', 'in', 'out', 'source'];

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadRows();
  }

  private loadSettings(): void {
    this.isLoadingSettings = true;
    this.api.hrPublicSettings().subscribe({
      next: (res) => { this.settings = res.data; this.isLoadingSettings = false; },
      error: () => { this.isLoadingSettings = false; },
    });
  }

  private loadRows(): void {
    this.isLoadingRows = true;
    this.api.hrMyAttendance().subscribe({
      next: (res) => {
        this.rows = (res.data || []).sort((a, b) => (a.date < b.date ? 1 : -1));
        this.today = this.rows.find(r => r.date === this.todayIso) || null;
        this.isLoadingRows = false;
      },
      error: () => { this.rows = []; this.today = null; this.isLoadingRows = false; },
    });
  }

  /** True when the employee still needs to punch — either no row for
   *  today, or 2-punch tenant that has only an IN so far. */
  get canPunch(): boolean {
    if (!this.settings?.locationBasedEnabled) return false;
    if (!this.today) return true;
    if (this.settings.expectedPunchesPerDay >= 2 && !this.today.outTime) return true;
    return false;
  }

  get punchButtonLabel(): string {
    if (!this.today) return 'Mark IN';
    if (!this.today.outTime) return 'Mark OUT';
    return 'Done for today';
  }

  /**
   * Handler for the "Mark IN/OUT" button. Uses the browser's
   * Geolocation API to get coordinates, then hits the backend which
   * runs the geofence + mock-GPS + accuracy checks.
   *
   * <p>Error paths (surfaced via snackbar):</p>
   * <ul>
   *   <li>Browser rejects permission → "Location permission denied. Enable it in browser settings."</li>
   *   <li>Timeout / no fix → "Couldn't get your location. Try moving to an open area."</li>
   *   <li>Backend geofence reject → shows exact distance from BusinessException</li>
   *   <li>Backend accuracy reject → shows accuracy</li>
   *   <li>Backend mock-GPS reject → tells the user to turn off Developer options</li>
   * </ul>
   */
  markAttendance(): void {
    if (this.isMarking || !this.canPunch) return;
    if (!navigator.geolocation) {
      this.snack.open('Your browser doesn\'t support location. Contact IT support.', 'Close', { duration: 4000 });
      return;
    }
    this.isMarking = true;
    // High accuracy = uses GPS not just Wi-Fi triangulation; timeout
    // covers the "hunting for satellites" case indoors.
    navigator.geolocation.getCurrentPosition(
      (pos) => this.sendMark(pos),
      (err) => {
        this.isMarking = false;
        if (err.code === err.PERMISSION_DENIED) {
          this.snack.open(
            'Location permission denied. Please enable location access in your browser settings.',
            'Close', { duration: 5000 });
        } else if (err.code === err.TIMEOUT) {
          this.snack.open(
            'Couldn\'t get your location in time. Try moving to an open area and tap again.',
            'Close', { duration: 5000 });
        } else {
          this.snack.open(
            'Couldn\'t get your location. Make sure GPS is on.',
            'Close', { duration: 4000 });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  private sendMark(pos: GeolocationPosition): void {
    this.api.hrMarkSelf({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracyMeters: pos.coords.accuracy,
      // Browser geolocation doesn't expose a mock flag — Android's
      // Location.isFromMockProvider() lives on the native SDK, not
      // Web. Send false; backend can still reject on other signals.
      mocked: false,
    }).subscribe({
      next: (res) => {
        this.isMarking = false;
        const direction = res.data?.punchDirection || 'IN';
        this.snack.open(`Marked ${direction} at ${this.formatTime(res.data?.inTime, res.data?.outTime, direction)}`,
          'Close', { duration: 3500 });
        this.loadRows();
      },
      error: (err) => {
        this.isMarking = false;
        const msg = err?.error?.message || 'Failed to mark attendance';
        this.snack.open(msg, 'Close', { duration: 5000 });
      },
    });
  }

  private formatTime(inTime?: string, outTime?: string, direction: string = 'IN'): string {
    const iso = direction === 'OUT' ? outTime : inTime;
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatRowTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatRowDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  statusChipClass(status: string): string {
    switch (status) {
      case 'PRESENT':  return 'chip-present';
      case 'LATE':     return 'chip-late';
      case 'HALF_DAY': return 'chip-halfday';
      case 'ABSENT':   return 'chip-absent';
      default:         return '';
    }
  }

  private formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
