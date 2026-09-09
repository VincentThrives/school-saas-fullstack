import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../../core/services/api.service';
import { EmployeeLeaveBalanceSheet, LeaveBalance } from '../../../../core/models';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { OverrideBalanceDialogComponent } from './override-balance-dialog/override-balance-dialog.component';

/**
 * HR Balances page — see every employee's full leave-balance sheet
 * for the year and override any single (employee, type) row when
 * policy calls for it (senior teacher gets extra EL, mid-year joiner
 * on pro-rated CL, etc).
 *
 * <p>Layout: a searchable list of employees on the left, each with a
 * compact grid of their leave types + remaining balance. Clicking
 * any type opens the override dialog for that (employee, type,
 * year) tuple. The year selector at the top switches the whole
 * sheet.</p>
 */
@Component({
  selector: 'app-hr-leave-balances',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-leave-balances.component.html',
  styleUrl: './hr-leave-balances.component.scss',
})
export class HrLeaveBalancesComponent implements OnInit {

  sheets: EmployeeLeaveBalanceSheet[] = [];
  isLoading = false;

  searchText = '';
  year = new Date().getFullYear();

  /** Years to show in the selector — current + 2 back + 1 forward
   *  is enough for retrospective and year-planning use. */
  readonly yearOptions: number[] = (() => {
    const now = new Date().getFullYear();
    return [now + 1, now, now - 1, now - 2];
  })();

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading = true;
    this.api.hrAllLeaveBalances(this.year).subscribe({
      next: (res) => { this.sheets = res.data || []; this.isLoading = false; },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load balances.', 'Close', { duration: 4000 });
      },
    });
  }

  onYearChange(): void { this.load(); }

  get filteredSheets(): EmployeeLeaveBalanceSheet[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.sheets;
    return this.sheets.filter(s =>
      s.employeeName.toLowerCase().includes(q)
      || (s.designation || '').toLowerCase().includes(q)
      || s.employeeId.toLowerCase().includes(q));
  }

  openOverride(sheet: EmployeeLeaveBalanceSheet, balance: LeaveBalance): void {
    const ref = this.dialog.open(OverrideBalanceDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      panelClass: ['centered-dialog'],
      data: {
        employeeId: sheet.employeeId,
        employeeName: sheet.employeeName,
        year: this.year,
        balance,
      },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  /** How much of the mandatory quota is left before year-end. Zero
   *  or negative means "target already hit". Positive means "still
   *  outstanding". */
  mandatoryRemaining(b: LeaveBalance): number {
    if (!b.mandatoryPerYear) return 0;
    return Math.max(0, b.mandatoryPerYear - b.mandatoryUsed);
  }

  /** Used %, capped at 100 for the progress bar. */
  usedPct(b: LeaveBalance): number {
    const total = b.allocated + b.carryForwardIn;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((b.used / total) * 100));
  }
}
