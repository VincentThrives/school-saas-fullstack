import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {
  MatDialogModule, MatDialogRef, MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../../core/services/api.service';
import { HrTerminalPunch } from '../../../../../core/models';

/**
 * Modal dialog that shows biometric punches on one terminal for a
 * picked date. Opened from the HR Terminal Bindings page's top-bar
 * "View punches" button so the main bindings view stays focused on
 * enrolment; punch-history browsing gets a dedicated surface.
 *
 * <p>Input: {@code serial} of the selected terminal and its
 * {@code label} (for the dialog header). Everything else — date
 * picker state, loading, table rendering — lives inside the
 * dialog so opening / closing it doesn't shuffle state on the
 * parent page.</p>
 */
@Component({
  selector: 'app-hr-terminal-punches-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatTableModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule,
    MatDialogModule, MatSnackBarModule,
  ],
  templateUrl: './hr-terminal-punches-dialog.component.html',
  styleUrl: './hr-terminal-punches-dialog.component.scss',
})
export class HrTerminalPunchesDialogComponent implements OnInit {

  /** Defaults to today at open — HR usually wants "who scanned
   *  today" first. Changing the picker fires reload; no separate
   *  submit button. */
  punchesDate: Date = new Date();
  punches: HrTerminalPunch[] = [];
  isLoading = false;

  readonly displayedCols: string[] = ['employee', 'userId', 'in', 'out', 'status'];

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private ref: MatDialogRef<HrTerminalPunchesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { serial: string; label?: string | null },
  ) {}

  ngOnInit(): void {
    this.load();
  }

  onDateChange(): void {
    this.load();
  }

  load(): void {
    if (!this.data?.serial) return;
    this.isLoading = true;
    const iso = this.toIsoDate(this.punchesDate);
    this.api.hrTerminalPunches(this.data.serial, iso).subscribe({
      next: (res) => {
        this.punches = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load punches', 'Close', { duration: 3000 });
      },
    });
  }

  close(): void {
    this.ref.close();
  }

  clockTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private toIsoDate(d: Date): string {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
