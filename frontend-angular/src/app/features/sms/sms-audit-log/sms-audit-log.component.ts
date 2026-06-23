import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService, SmsAuditLogDto, SmsTriggerKey } from '../../../core/services/api.service';
import { AcademicYear } from '../../../core/models';

interface TriggerOption {
  key: SmsTriggerKey;
  label: string;
}

interface StatusBucket {
  value: string;     // CSV passed to backend ("SENT,DELIVERED", "FAILED,SKIPPED", "")
  label: string;
}

@Component({
  selector: 'app-sms-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './sms-audit-log.component.html',
  styleUrl: './sms-audit-log.component.scss',
  providers: [provideNativeDateAdapter()],
})
export class SmsAuditLogComponent implements OnInit {
  // ── Filters ──────────────────────────────────────────────────────────
  academicYearFilter = '';
  triggerFilter = '';
  statusFilter = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  /** Class chip filter for the audit table. Page-local — narrows the
   *  visible rows whose {@link SmsAuditLogDto.relatedStudentClass}
   *  matches the picked label. 'ALL' shows every row on the page. */
  classFilter: string = 'ALL';

  academicYears: AcademicYear[] = [];

  /** Trigger options shown in the dropdown. Keys match the SmsTriggerKey
   *  enum on the backend; the friendly label is admin-facing. */
  readonly triggers: ReadonlyArray<TriggerOption> = [
    { key: 'ABSENCE_ALERT',  label: 'Absence Alert' },
    { key: 'RESULT_COMBINED', label: 'Result (combined)' },
    { key: 'RESULT_SINGLE',   label: 'Result (subject)' },
    { key: 'HOLIDAY_NOTICE',  label: 'Holiday Notice' },
    { key: 'EVENT_NOTICE',    label: 'Event Notice' },
  ];

  /** Status buckets — admin picks "Sent" / "Not Sent" / "Pending"; we
   *  translate to the backend's CSV of raw enum values so SENT and
   *  DELIVERED count as the same bucket from the user's POV. */
  readonly statusBuckets: ReadonlyArray<StatusBucket> = [
    { value: '',                  label: 'All' },
    { value: 'SENT,DELIVERED',    label: 'Sent' },
    { value: 'FAILED,SKIPPED',    label: 'Not Sent' },
    { value: 'PENDING',           label: 'Pending' },
  ];

  // ── Data ─────────────────────────────────────────────────────────────
  rows: SmsAuditLogDto[] = [];
  displayedColumns = ['date', 'trigger', 'recipient', 'body', 'cost', 'status', 'reason'];
  totalElements = 0;
  pageIndex = 0;
  pageSize = 25;
  isLoading = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
        const current = this.academicYears.find(y => y.current);
        if (current) this.academicYearFilter = current.academicYearId;
        // Year doesn't affect dateFrom/dateTo directly — we derive the
        // range at fetch time so admins can override with explicit dates.
        this.load();
      },
    });
  }

  /** Translate the picked academic year into a [start, end+1day) range
   *  used as the default date filter when admin hasn't typed explicit
   *  dates. Indian school years run Apr 1 → Mar 31 — using the year
   *  label's two parts (e.g. "2026-2027") drives the range. */
  private deriveYearRange(): { from?: string; to?: string } {
    if (!this.academicYearFilter) return {};
    const y = this.academicYears.find(x => x.academicYearId === this.academicYearFilter);
    if (!y?.label) return {};
    // Try to parse "2026-2027" / "2026 - 2027" / "2026/2027" patterns.
    const m = y.label.match(/(\d{4}).*?(\d{4})/);
    if (!m) return {};
    const start = `${m[1]}-04-01`;        // Apr 1 of first year
    const endYearNum = parseInt(m[2], 10) + 1;
    const end = `${endYearNum}-04-01`;    // Apr 1 of (second year + 1) — exclusive
    return { from: start, to: end };
  }

  /** Convert a JS Date into the `yyyy-MM-dd` shape the backend accepts. */
  private toIsoDate(d: Date | null): string | undefined {
    if (!d) return undefined;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  load(): void {
    this.isLoading = true;
    // Explicit date pickers win. When neither is set, fall back to the
    // academic year range so the table reflects "this year" by default.
    const explicitFrom = this.toIsoDate(this.dateFrom);
    const explicitTo   = this.toIsoDate(this.dateTo);
    const range = (!explicitFrom && !explicitTo) ? this.deriveYearRange() : {};
    // For an exclusive to-edge: if the admin picks "11 Jun" they expect
    // events up to 11 Jun 23:59 included — add a day.
    let toForBackend = explicitTo;
    if (toForBackend) {
      const t = new Date(toForBackend);
      t.setDate(t.getDate() + 1);
      toForBackend = this.toIsoDate(t);
    }

    const filter: any = {};
    if (this.triggerFilter) filter.trigger = this.triggerFilter;
    if (this.statusFilter)  filter.status  = this.statusFilter;
    const from = explicitFrom || range.from;
    const to   = toForBackend  || range.to;
    if (from) filter.dateFrom = from;
    if (to)   filter.dateTo   = to;

    this.api.getMySmsAuditLogs(this.pageIndex, this.pageSize, filter).subscribe({
      next: (res) => {
        const data = res?.data;
        this.rows = data?.content || [];
        this.totalElements = data?.totalElements ?? this.rows.length;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load audit log', 'Close', { duration: 3000 });
      },
    });
  }

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.load();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    if (this.paginator) this.paginator.firstPage();
    this.load();
  }

  clearFilters(): void {
    this.triggerFilter = '';
    this.statusFilter = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.classFilter = 'ALL';
    // Keep the academic year — that's the natural scope, not a filter.
    this.onFilterChange();
  }

  /** Distinct class labels present on the current page's rows. Drives
   *  the chip listbox; hidden when there's only one (or none). */
  classOptions(): string[] {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.relatedStudentClass) set.add(r.relatedStudentClass);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /** Rows after the class chip filter. Page-local — chip narrows what's
   *  rendered from the current page, but pagination + totalElements
   *  reflect the unfiltered backend response. */
  filteredRows(): SmsAuditLogDto[] {
    if (this.classFilter === 'ALL') return this.rows;
    return this.rows.filter(r => r.relatedStudentClass === this.classFilter);
  }

  // ── Display helpers ─────────────────────────────────────────────────

  triggerLabel(trigger: string): string {
    return this.triggers.find(t => t.key === trigger)?.label || trigger;
  }

  /** Class for the status chip — drives the colour. */
  statusClass(status?: string): string {
    switch (status) {
      case 'SENT':
      case 'DELIVERED':
        return 'chip-sent';
      case 'FAILED':
      case 'SKIPPED':
        return 'chip-failed';
      case 'PENDING':
        return 'chip-pending';
      default:
        return 'chip-neutral';
    }
  }

  /** True when status represents a "not sent" outcome — drives the
   *  Reason column visibility per row. */
  isNotSent(status?: string): boolean {
    return status === 'FAILED' || status === 'SKIPPED';
  }

  /** Friendly reason text. FAILED rows use the upstream errorMessage;
   *  SKIPPED rows use a short generic ("Skipped — see settings"). */
  reasonFor(row: SmsAuditLogDto): string {
    if (row.status === 'FAILED') {
      return row.errorMessage || 'Delivery failed (no details from gateway)';
    }
    if (row.status === 'SKIPPED') {
      return row.errorMessage || 'Skipped — tenant config or budget gate';
    }
    return '';
  }

  /** Truncate body for table cell — full text in tooltip. */
  truncate(text?: string, max = 60): string {
    if (!text) return '';
    return text.length > max ? text.substring(0, max - 1) + '…' : text;
  }

  goBack(): void {
    this.router.navigate(['/settings/sms']);
  }
}
