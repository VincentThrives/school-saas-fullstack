import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { FeatureAuditLog } from '../../../core/models';

@Component({
  selector: 'app-feature-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DatePipe,
  ],
  templateUrl: './feature-audit-log.component.html',
  styleUrl: './feature-audit-log.component.scss',
})
export class FeatureAuditLogComponent implements OnInit, OnDestroy {
  tenantId = '';
  auditLogs: FeatureAuditLog[] = [];
  filteredLogs: FeatureAuditLog[] = [];
  displayedColumns = ['timestamp', 'feature', 'change', 'changedBy', 'reason', 'actions'];
  isLoading = false;
  totalElements = 0;
  pageSize = 20;
  pageIndex = 0;
  searchTerm = '';

  breadcrumbs: Breadcrumb[] = [
    { label: 'Super Admin', link: '/superadmin/dashboard' },
    { label: 'Features' },
    { label: 'Audit Log' },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.tenantId = params['tenantId'] || '';
      if (this.tenantId) {
        this.breadcrumbs = [
          { label: 'Super Admin', link: '/superadmin/dashboard' },
          { label: 'Features', link: `/superadmin/features/${this.tenantId}` },
          { label: 'Audit Log' },
        ];
        this.loadAuditLog();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAuditLog(): void {
    this.isLoading = true;
    this.api.getFeatureAuditLog(this.tenantId, this.pageIndex, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.auditLogs = res.data.content || [];
            this.totalElements = res.data.totalElements || 0;
            this.applyFilter();
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open('Failed to load audit log', 'Close', { duration: 3000 });
        },
      });
  }

  applyFilter(): void {
    if (!this.searchTerm.trim()) {
      this.filteredLogs = this.auditLogs;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredLogs = this.auditLogs.filter(
        (log) =>
          log.featureDisplayName.toLowerCase().includes(term) ||
          log.changedByName.toLowerCase().includes(term),
      );
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadAuditLog();
  }

  canUndo(log: FeatureAuditLog): boolean {
    if (log.undone) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(log.timestamp) > fiveMinutesAgo;
  }

  undoToggle(log: FeatureAuditLog): void {
    this.api.undoFeatureToggle(this.tenantId, log.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Change undone successfully', 'Close', { duration: 2000 });
          this.loadAuditLog();
        },
        error: () => {
          this.snackBar.open('Failed to undo change', 'Close', { duration: 3000 });
        },
      });
  }

  exportCsv(): void {
    const headers = ['Timestamp', 'Feature', 'Previous State', 'New State', 'Changed By', 'Reason', 'Undone'];
    const rows = this.auditLogs.map((log) => [
      log.timestamp,
      log.featureDisplayName,
      log.previousState ? 'Enabled' : 'Disabled',
      log.newState ? 'Enabled' : 'Disabled',
      log.changedByName,
      log.changeReason || '',
      log.undone ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feature-audit-${this.tenantId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
