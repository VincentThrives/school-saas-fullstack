import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MatDialogModule, MatDialogRef, MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { ApiService } from '../../../../../core/services/api.service';
import {
  HrEmployeeOption, HrDailyAttendance, ManualMarkRequest,
} from '../../../../../core/models';

/**
 * Two-mode dialog for HR to fix attendance rows:
 * <ul>
 *   <li><b>Edit</b> mode — opened from a row's pencil button on the
 *       Daily page. Employee is fixed (comes from the row); HR just
 *       adjusts status + times.</li>
 *   <li><b>Add missing</b> mode — opened from the page's "+ Add
 *       missing employee" button. Employee picker is shown so HR can
 *       pick anyone from the roster.</li>
 * </ul>
 *
 * <p>Both modes POST to {@code /hr/attendance/mark-manual} on save.
 * The backend upserts by (employeeId, date) so re-editing the same
 * row just overlays new values.</p>
 */
@Component({
  selector: 'app-hr-manual-mark-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule,
  ],
  templateUrl: './hr-manual-mark-dialog.component.html',
  styleUrl: './hr-manual-mark-dialog.component.scss',
})
export class HrManualMarkDialogComponent implements OnInit {

  /** Add-missing mode: fetched fresh; Edit mode: unused. */
  employees: HrEmployeeOption[] = [];
  isLoadingEmployees = false;
  isSaving = false;

  // Form fields
  employeeId: string | null = null;
  date: Date;
  status: string = 'PRESENT';
  /** "HH:MM" strings bound to <input type="time"> — converted to
   *  full ISO instants at save time using the picked date + tenant
   *  zone. */
  inTime: string = '';
  outTime: string = '';
  remarks: string = '';

  readonly statuses = [
    { value: 'PRESENT',  label: 'Present' },
    { value: 'LATE',     label: 'Late' },
    { value: 'HALF_DAY', label: 'Half day' },
    { value: 'ABSENT',   label: 'Absent' },
  ];

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private ref: MatDialogRef<HrManualMarkDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: {
      mode: 'edit' | 'add';
      // For edit mode — the existing row to preload from.
      row?: HrDailyAttendance;
      // For add mode — an optional preselected date (defaults to today).
      defaultDate?: Date;
      // For add mode — employee ids that already have a row on the
      // picked date. The picker filters these out so HR only sees
      // employees who genuinely need a manual entry.
      alreadyMarkedIds?: string[];
    },
  ) {
    this.date = data.defaultDate || (data.row ? new Date(data.row.date) : new Date());
    if (data.row) {
      this.employeeId = data.row.employeeId;
      this.status = data.row.status || 'PRESENT';
      this.inTime = this.instantToHHMM(data.row.inTime);
      this.outTime = this.instantToHHMM(data.row.outTime);
      this.remarks = data.row.remarks || '';
    }
  }

  ngOnInit(): void {
    if (this.data.mode === 'add') this.loadEmployees();
  }

  private loadEmployees(): void {
    this.isLoadingEmployees = true;
    // Set built once here so the filter in the subscribe callback is
    // O(1) per employee instead of an Array.includes scan per row.
    const skip = new Set(this.data.alreadyMarkedIds || []);
    this.api.hrListEmployees().subscribe({
      next: (res) => {
        const list = res.data || [];
        // Filter out anyone already marked for the picked date — HR
        // only sees employees who genuinely need a manual row.
        this.employees = list.filter(e => !skip.has(e.employeeId));
        this.isLoadingEmployees = false;
      },
      error: () => {
        this.isLoadingEmployees = false;
        this.snack.open('Failed to load employees', 'Close', { duration: 3000 });
      },
    });
  }

  save(): void {
    if (this.isSaving) return;
    if (!this.employeeId) {
      this.snack.open('Pick an employee first.', 'Close', { duration: 2500 });
      return;
    }
    if (!this.date) {
      this.snack.open('Pick a date.', 'Close', { duration: 2500 });
      return;
    }
    if (!this.status) {
      this.snack.open('Pick a status.', 'Close', { duration: 2500 });
      return;
    }
    const req: ManualMarkRequest = {
      employeeId: this.employeeId,
      date: this.toIsoDate(this.date),
      status: this.status,
      inTime: this.hhmmToIso(this.inTime, this.date),
      outTime: this.hhmmToIso(this.outTime, this.date),
      remarks: this.remarks?.trim() || undefined,
    };
    this.isSaving = true;
    this.api.hrManualMark(req).subscribe({
      next: () => {
        this.isSaving = false;
        this.snack.open('Attendance saved', 'Close', { duration: 2500 });
        this.ref.close(true);
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(
          err?.error?.message || 'Failed to save',
          'Close', { duration: 3500 });
      },
    });
  }

  close(): void {
    this.ref.close(false);
  }

  // ── Helpers ─────────────────────────────────

  displayEmployee(): string {
    if (this.data.mode !== 'edit' || !this.data.row) return '';
    const d = this.data.row.designation ? ` · ${this.data.row.designation}` : '';
    return `${this.data.row.employeeName}${d}`;
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  /** "HH:MM" (browser-local) → ISO instant on the picked date. */
  private hhmmToIso(hhmm: string, date: Date): string | undefined {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  /** ISO instant → "HH:MM" for pre-fill on edit. */
  private instantToHHMM(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
