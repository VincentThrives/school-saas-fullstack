import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LeaveApplication } from '../../../../core/models';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { LeaveApprovalDialogComponent } from './leave-approval-dialog/leave-approval-dialog.component';

/**
 * HR Leave Approvals — mirrors the shape of {@code HrApprovalsComponent}
 * (regularization approvals). Two MatTabs: Pending queue and History.
 * Per-row spinner state via {@code reviewingIds} so a slow approve
 * doesn't grey out the whole list. All actions round-trip through a
 * single {@link LeaveApprovalDialogComponent} shared between approve
 * and reject flows — mode is passed in via dialog data.
 */
@Component({
  selector: 'app-hr-leave-approvals',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatTabsModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-leave-approvals.component.html',
  styleUrl: './hr-leave-approvals.component.scss',
})
export class HrLeaveApprovalsComponent implements OnInit {

  pending: LeaveApplication[] = [];
  history: LeaveApplication[] = [];
  isLoading = false;
  reviewingIds = new Set<string>();

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading = true;
    forkJoin({
      pending: this.api.hrPendingLeaves(),
      history: this.api.hrLeaveHistory(),
    }).subscribe({
      next: (res) => {
        this.pending = res.pending.data || [];
        this.history = res.history.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load leaves.', 'Close', { duration: 4000 });
      },
    });
  }

  openReview(row: LeaveApplication, mode: 'approve' | 'reject'): void {
    if (this.reviewingIds.has(row.id)) return;
    const ref = this.dialog.open(LeaveApprovalDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      panelClass: ['centered-dialog'],
      data: { leave: row, mode },
    });
    ref.afterClosed().subscribe((result: { notes?: string } | undefined) => {
      if (!result) return;
      this.reviewingIds.add(row.id);
      const call$ = mode === 'approve'
        ? this.api.hrApproveLeave(row.id, { notes: result.notes })
        : this.api.hrRejectLeave(row.id, { notes: result.notes });
      call$.subscribe({
        next: () => {
          this.reviewingIds.delete(row.id);
          this.snack.open(mode === 'approve'
              ? 'Leave approved. Attendance updated.'
              : 'Leave rejected.',
            'Close', { duration: 3000 });
          this.load();
        },
        error: (err) => {
          this.reviewingIds.delete(row.id);
          this.snack.open(err?.error?.message || 'Action failed.',
            'Close', { duration: 4500 });
        },
      });
    });
  }

  formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatDateTime(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  formatRange(row: LeaveApplication): string {
    if (row.startDate === row.endDate) {
      const suffix = row.startHalf ? ' (half)' : '';
      return this.formatDate(row.startDate) + suffix;
    }
    const startSuffix = row.startHalf ? ' (half)' : '';
    const endSuffix = row.endHalf ? ' (half)' : '';
    return `${this.formatDate(row.startDate)}${startSuffix} → ${this.formatDate(row.endDate)}${endSuffix}`;
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
}
