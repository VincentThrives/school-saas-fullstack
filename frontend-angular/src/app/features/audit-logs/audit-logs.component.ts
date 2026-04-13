import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { PageHeaderComponent, Breadcrumb } from '../../shared/components/page-header/page-header.component';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-audit-logs',
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
    MatSelectModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DatePipe,
  ],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.scss',
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  logs: any[] = [];
  totalElements = 0;
  page = 0;
  pageSize = 20;
  isLoading = false;

  // Filters
  searchQuery = '';
  actionFilter = '';
  entityTypeFilter = '';
  tenantIdFilter = '';
  dateFrom = '';
  dateTo = '';

  // Filter options
  actions: string[] = [];
  entityTypes: string[] = [];

  displayedColumns = ['timestamp', 'action', 'entity', 'description', 'user', 'tenantId', 'ipAddress'];

  breadcrumbs: Breadcrumb[] = [
    { label: 'Super Admin', link: '/superadmin/dashboard' },
    { label: 'Audit Logs' },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFilterOptions(): void {
    forkJoin([
      this.api.getAuditLogActions(),
      this.api.getAuditLogEntityTypes(),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([actionsRes, entityTypesRes]) => {
          if (actionsRes.success && actionsRes.data) {
            this.actions = actionsRes.data;
          }
          if (entityTypesRes.success && entityTypesRes.data) {
            this.entityTypes = entityTypesRes.data;
          }
        },
        error: () => {
          this.snackBar.open('Failed to load filter options', 'Close', { duration: 3000 });
        },
      });
  }

  loadLogs(): void {
    this.isLoading = true;
    const filters: any = {};
    if (this.actionFilter) filters.action = this.actionFilter;
    if (this.entityTypeFilter) filters.entityType = this.entityTypeFilter;
    if (this.tenantIdFilter) filters.tenantId = this.tenantIdFilter;
    if (this.dateFrom) filters.from = new Date(this.dateFrom).toISOString();
    if (this.dateTo) filters.to = new Date(this.dateTo).toISOString();
    if (this.searchQuery) filters.search = this.searchQuery;

    this.api.getAuditLogs(this.page, this.pageSize, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.logs = res.data.content || [];
            this.totalElements = res.data.totalElements || 0;
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open('Failed to load audit logs', 'Close', { duration: 3000 });
        },
      });
  }

  onSearch(): void {
    this.page = 0;
    this.loadLogs();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.actionFilter = '';
    this.entityTypeFilter = '';
    this.tenantIdFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.page = 0;
    this.loadLogs();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadLogs();
  }

  getActionColor(action: string): string {
    switch (action?.toUpperCase()) {
      case 'LOGIN': return 'action-blue';
      case 'CREATE': return 'action-green';
      case 'UPDATE': return 'action-orange';
      case 'DELETE': return 'action-red';
      case 'TOGGLE': return 'action-purple';
      default: return 'action-grey';
    }
  }

  shortenId(id: string): string {
    if (!id) return '-';
    return id.length > 12 ? id.substring(0, 12) + '...' : id;
  }

  exportCsv(): void {
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Description', 'User ID', 'User Role', 'Tenant ID', 'IP Address'];
    const rows = this.logs.map((log) => [
      log.timestamp,
      log.action,
      log.entityType,
      log.entityId || '',
      log.description || '',
      log.userId || '',
      log.userRole || '',
      log.tenantId || '',
      log.ipAddress || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell: string) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
