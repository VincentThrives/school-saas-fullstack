import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../../core/services/api.service';
import { LeaveApplication, LeaveBalance } from '../../../../core/models';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApplyLeaveDialogComponent } from './apply-leave-dialog/apply-leave-dialog.component';

/**
 * Employee's Leave hub — balance widget across the top, an Apply
 * Leave button, and the employee's own leave history below (pending
 * first, then approved / rejected / cancelled).
 *
 * <p>Deliberately kept dashboard-simple: no filters, no pagination.
 * Employees look at their own leaves — the list is naturally short
 * (dozens per year at most).</p>
 */
@Component({
  selector: 'app-my-leave',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule, MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-leave.component.html',
  styleUrl: './my-leave.component.scss',
})
export class MyLeaveComponent implements OnInit {

  balances: LeaveBalance[] = [];
  leaves: LeaveApplication[] = [];
  isLoading = false;
  cancellingId: string | null = null;

  currentYear = new Date().getFullYear();

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.api.hrMyLeaveBalance(this.currentYear).subscribe({
      next: (res) => { this.balances = res.data || []; },
      error: () => { /* silent — balance widget can be empty on first-ever load */ },
    });
    this.api.hrMyLeaves().subscribe({
      next: (res) => {
        this.leaves = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load your leaves.', 'Close', { duration: 4000 });
      },
    });
  }

  openApply(): void {
    const ref = this.dialog.open(ApplyLeaveDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: ['centered-dialog'],
      autoFocus: 'first-tabbable',
    });
    ref.afterClosed().subscribe((submitted) => { if (submitted) this.load(); });
  }

  /** Employees can cancel their own PENDING leaves and their APPROVED
   *  leaves whose start date hasn't arrived yet. Server enforces + we
   *  disable the button in the UI so users don't get a rejection toast
   *  they can't act on. */
  canCancel(row: LeaveApplication): boolean {
    if (row.status === 'PENDING') return true;
    if (row.status !== 'APPROVED') return false;
    return row.startDate >= this.todayIso;
  }

  cancel(row: LeaveApplication): void {
    if (this.cancellingId) return;
    if (!confirm(`Cancel your ${row.leaveTypeCode} leave (${row.startDate} → ${row.endDate})?`)) return;
    this.cancellingId = row.id;
    this.api.hrCancelLeave(row.id).subscribe({
      next: () => {
        this.cancellingId = null;
        this.snack.open('Leave cancelled.', 'Close', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        this.cancellingId = null;
        this.snack.open(err?.error?.message || 'Failed to cancel leave.', 'Close', { duration: 4500 });
      },
    });
  }

  // ── UI helpers ─────────────────────────────────────────────

  get todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatRange(row: LeaveApplication): string {
    if (row.startDate === row.endDate) {
      const suffix = row.startHalf ? ' (half-day)' : '';
      return this.formatDate(row.startDate) + suffix;
    }
    return `${this.formatDate(row.startDate)} → ${this.formatDate(row.endDate)}`;
  }

  statusClass(s: LeaveApplication['status']): string {
    switch (s) {
      case 'PENDING':   return 'chip-pending';
      case 'APPROVED':  return 'chip-approved';
      case 'REJECTED':  return 'chip-rejected';
      case 'CANCELLED': return 'chip-cancelled';
      default: return '';
    }
  }

  /** Pending first, then most-recently-submitted downstream. */
  get sortedLeaves(): LeaveApplication[] {
    return [...this.leaves].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
      return (b.requestedAt || '').localeCompare(a.requestedAt || '');
    });
  }
}
