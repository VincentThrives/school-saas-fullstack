import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { HrDailyAttendance } from '../../../../core/models';
import { HrManualMarkDialogComponent } from './manual-mark-dialog/hr-manual-mark-dialog.component';

/**
 * HR-only daily view — one date at a time, every employee's row for
 * that date. Table shows: employee id + name + status chip + IN /
 * OUT times + source badge + distance (LOCATION rows only).
 *
 * <p>Employee names + designations are baked into the response by the
 * backend ({@code HrDailyAttendanceDto}) — HR can't call the admin-
 * gated {@code GET /employees} endpoint, so a client-side lookup would
 * silently fall back to raw UUIDs.</p>
 *
 * <p>Manual entry / edit lives on this page as a follow-up (v1 is
 * read-only). The Regularization Approvals page is a separate route
 * — kept independent so the queue count doesn't get lost in a big
 * combined table.</p>
 */
@Component({
  selector: 'app-hr-daily-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatTableModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-daily-attendance.component.html',
  styleUrl: './hr-daily-attendance.component.scss',
})
export class HrDailyAttendanceComponent implements OnInit {

  selectedDate: Date = new Date();
  today: Date = new Date();
  rows: HrDailyAttendance[] = [];

  isLoadingRows = false;

  displayedCols = ['employee', 'status', 'in', 'out', 'source', 'distance', 'actions'];

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  /** Open the manual-mark dialog in "add missing employee" mode.
   *  Passes the already-marked employee ids so the picker only shows
   *  people who don't yet have a row for the selected date — matches
   *  what HR sees on screen so the picker never offers a duplicate. */
  openAddDialog(): void {
    const alreadyMarkedIds = this.rows
      .map(r => r.employeeId)
      .filter(id => !!id);
    const ref = this.dialog.open(HrManualMarkDialogComponent, {
      data: {
        mode: 'add',
        defaultDate: this.selectedDate,
        alreadyMarkedIds,
      },
      autoFocus: false,
      panelClass: 'hr-manual-mark-panel',
      width: '100vw',
      maxWidth: '100vw',
    });
    ref.afterClosed().subscribe((saved) => { if (saved) this.loadRows(); });
  }

  /** Open the manual-mark dialog in "edit row" mode. */
  openEditDialog(row: HrDailyAttendance): void {
    const ref = this.dialog.open(HrManualMarkDialogComponent, {
      data: { mode: 'edit', row },
      autoFocus: false,
      panelClass: 'hr-manual-mark-panel',
      width: '100vw',
      maxWidth: '100vw',
    });
    ref.afterClosed().subscribe((saved) => { if (saved) this.loadRows(); });
  }

  ngOnInit(): void {
    this.loadRows();
  }

  loadRows(): void {
    this.isLoadingRows = true;
    const iso = this.formatDateLocal(this.selectedDate);
    this.api.hrDailyAttendance(iso).subscribe({
      next: (res) => {
        this.rows = res.data || [];
        this.isLoadingRows = false;
      },
      error: () => {
        this.snack.open('Failed to load attendance', 'Close', { duration: 3000 });
        this.isLoadingRows = false;
      },
    });
  }

  onDateChange(): void {
    this.loadRows();
  }

  // ── Helpers ──────────────────────────────────────

  formatTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  formatDistance(m?: number): string {
    if (m == null) return '';
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
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

  sourceIcon(source: string): string {
    switch (source) {
      case 'LOCATION':       return 'location_on';
      case 'BIOMETRIC':      return 'fingerprint';
      case 'MANUAL':         return 'edit';
      case 'REGULARIZATION': return 'assignment_late';
      default:               return 'help_outline';
    }
  }

  /** ── Summary counters shown above the table ──────
   *  Client-side reduce over the rows — small enough (~50 rows) that
   *  a memoized getter isn't worth it. */
  get summary(): { present: number; late: number; halfDay: number; absent: number; total: number } {
    return this.rows.reduce((acc, r) => {
      acc.total++;
      if (r.status === 'PRESENT') acc.present++;
      else if (r.status === 'LATE') { acc.late++; acc.present++; }
      else if (r.status === 'HALF_DAY') acc.halfDay++;
      else if (r.status === 'ABSENT') acc.absent++;
      // "LATE" is counted twice on purpose above — as its own bucket
      // AND as a Present so the top-line "attended today" count is right.
      return acc;
    }, { present: 0, late: 0, halfDay: 0, absent: 0, total: 0 });
  }

  private formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
