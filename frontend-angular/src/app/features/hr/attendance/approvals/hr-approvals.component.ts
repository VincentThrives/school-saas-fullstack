import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { RegularizationRequest } from '../../../../core/models';
import { ApprovalDialogComponent } from './approval-dialog/approval-dialog.component';

/**
 * HR Approvals queue for regularization requests. Two tabs — a live
 * "Pending" queue with approve / reject actions and a "History" list
 * of anything already reviewed (approved / auto-approved / rejected).
 *
 * <p>Approve is one-click optimistic; reject prompts for a note first
 * because a rejection without explanation is a bad employee
 * experience.</p>
 */
@Component({
  selector: 'app-hr-approvals',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatTabsModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-approvals.component.html',
  styleUrl: './hr-approvals.component.scss',
})
export class HrApprovalsComponent implements OnInit {

  pending: RegularizationRequest[] = [];
  history: RegularizationRequest[] = [];

  isLoadingPending = false;
  isLoadingHistory = false;
  /** Set of request ids currently being reviewed — used to disable
   *  buttons + show a spinner per-row while an approve/reject is
   *  in flight. Prevents double-clicks. */
  reviewingIds = new Set<string>();

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadPending();
    this.loadHistory();
  }

  loadPending(): void {
    this.isLoadingPending = true;
    this.api.hrPendingRegularizations().subscribe({
      next: (res) => {
        this.pending = res.data || [];
        this.isLoadingPending = false;
      },
      error: () => {
        this.isLoadingPending = false;
        this.snack.open('Failed to load pending requests', 'Close', { duration: 3000 });
      },
    });
  }

  loadHistory(): void {
    this.isLoadingHistory = true;
    this.api.hrRegularizationHistory().subscribe({
      next: (res) => {
        this.history = res.data || [];
        this.isLoadingHistory = false;
      },
      error: () => {
        this.isLoadingHistory = false;
        this.snack.open('Failed to load history', 'Close', { duration: 3000 });
      },
    });
  }

  approve(r: RegularizationRequest): void {
    this.openReviewDialog(r, 'approve');
  }

  reject(r: RegularizationRequest): void {
    this.openReviewDialog(r, 'reject');
  }

  /** Shared approve/reject flow — pops the review dialog, hits the
   *  right endpoint on submit, and refreshes both lists. The
   *  dialog handles all the UX (preview, warning, note validation)
   *  so this method stays a thin router. */
  private openReviewDialog(r: RegularizationRequest,
                            mode: 'approve' | 'reject'): void {
    if (this.reviewingIds.has(r.id)) return;
    const ref = this.dialog.open(ApprovalDialogComponent, {
      data: { request: r, mode },
      autoFocus: false,
      panelClass: 'approval-dialog-panel',
      width: '100vw',
      maxWidth: '100vw',
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;   // user cancelled
      this.reviewingIds.add(r.id);
      const payload = { notes: result.notes || undefined };
      const call$ = result.action === 'approve'
        ? this.api.hrApproveRegularization(r.id, payload)
        : this.api.hrRejectRegularization(r.id, payload);
      call$.subscribe({
        next: () => {
          this.reviewingIds.delete(r.id);
          this.snack.open(
            result.action === 'approve'
              ? 'Approved. Attendance updated.'
              : 'Request rejected.',
            'Close', { duration: 2500 });
          this.loadPending();
          this.loadHistory();
        },
        error: (err) => {
          this.reviewingIds.delete(r.id);
          this.snack.open(
            err?.error?.message
              || (result.action === 'approve' ? 'Failed to approve' : 'Failed to reject'),
            'Close', { duration: 3500 });
        },
      });
    });
  }

  // ── Formatters ──────────────────────────────

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  formatTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PENDING':        return 'chip-pending';
      case 'AUTO_APPROVED':  return 'chip-approved';
      case 'APPROVED':       return 'chip-approved';
      case 'REJECTED':       return 'chip-rejected';
      default:               return '';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PENDING':        return 'Pending';
      case 'AUTO_APPROVED':  return 'Auto-approved';
      case 'APPROVED':       return 'Approved';
      case 'REJECTED':       return 'Rejected';
      default:               return status;
    }
  }
}
