import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SmsConfirmDialogComponent, SmsConfirmData } from './sms-confirm-dialog.component';
import {
  ApiService,
  SmsAuditLogDto,
  TenantSmsSettingsDto,
  SendCustomNoticeRequest,
  SmsBroadcastAudience,
  AbsentTodayDto,
} from '../../../core/services/api.service';
import { SchoolClass } from '../../../core/models';
import { TenantFeatureService } from '../../../core/services/tenant-feature.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

/**
 * Tenant-side SMS view. Two panels stacked:
 *   1. Read-only status card showing which triggers are enabled and
 *      this month's usage vs budget.
 *   2. Audit log table — every SMS sent for this tenant, paginated.
 *
 * Plus a "Send Test SMS" button (gated by global+tenant SMS enabled).
 *
 * The route is protected by `smsFeatureGuard` so this component never
 * loads for tenants with SMS off. But we double-check inside as a
 * defensive measure — if the guard ever flips off due to a feature
 * refresh, the user sees a "redirected" empty state rather than an
 * exception.
 */
@Component({
  selector: 'app-sms-view',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatIconModule, MatButtonModule, MatTableModule,
    MatChipsModule, MatCheckboxModule, MatPaginatorModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule, MatSnackBarModule,
    MatSelectModule, MatDialogModule,
    PageHeaderComponent,
  ],
  templateUrl: './sms-view.component.html',
  styleUrl: './sms-view.component.scss',
})
export class SmsViewComponent implements OnInit {
  features = inject(TenantFeatureService);

  settings: TenantSmsSettingsDto | null = null;
  isLoadingSettings = false;

  // Audit log table state
  logs: SmsAuditLogDto[] = [];
  totalLogs = 0;
  pageIndex = 0;
  pageSize = 25;
  isLoadingLogs = false;
  readonly logColumns = ['createdAt', 'trigger', 'recipientPhone', 'status', 'cost'];

  // Test SMS form
  testPhone = '';
  isSendingTest = false;

  // ── Today's absent students (manual SMS) ─────────────────
  /** Loaded picker rows. Null = not loaded yet, [] = loaded but empty. */
  absentToday: AbsentTodayDto[] | null = null;
  /** Ticked studentIds — defaults to all unsent-with-phone rows after load. */
  selectedAbsentIds = new Set<string>();
  isLoadingAbsent = false;
  isSendingAbsent = false;

  // ── Custom-notice broadcast form ─────────────────────────
  /** Audiences the message will fan out to. Multi-select via checkboxes —
   *  the backend takes the UNION of all picked audiences (deduped by
   *  phone in the dispatch pipeline). Defaults to "all students' parents"
   *  since that's the overwhelmingly common case for school notices. */
  broadcastAudiences = new Set<SmsBroadcastAudience>(['ALL_STUDENTS']);
  /** Class picked when CLASS is among the chosen audiences — empty otherwise. */
  broadcastClassId = '';
  /** Free-text body. Capped at 300 chars to stay inside the DLT-approved
   *  CUSTOM_NOTICE template body length. */
  broadcastMessage = '';
  /** Lazy-loaded on first interest so the page snaps in fast even on
   *  schools with hundreds of classes. */
  classes: SchoolClass[] = [];
  isLoadingClasses = false;
  isSendingBroadcast = false;
  /** Visual feedback for the textarea — drives the char counter colour. */
  readonly BROADCAST_MAX = 300;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  /** Cost per SMS — kept in sync with backend SmsConfig.cost-per-sms-inr.
   *  Could be fetched from /sms/settings later if we want one source of
   *  truth, but for now a constant is fine and avoids an extra round-trip
   *  on every confirm click. */
  readonly COST_PER_SMS = 0.25;

  ngOnInit(): void {
    this.loadSettings();
    this.loadLogs();
  }

  // ── Settings ──────────────────────────────────────────────

  loadSettings(): void {
    this.isLoadingSettings = true;
    this.api.getMySmsSettings().subscribe({
      next: (res) => {
        this.settings = res?.data ?? null;
        this.isLoadingSettings = false;
      },
      error: () => { this.isLoadingSettings = false; },
    });
  }

  /** Percentage of monthly budget consumed — drives the progress bar. */
  get budgetUsedPct(): number {
    if (!this.settings || this.settings.monthlyBudgetInr <= 0) return 0;
    const pct = (this.settings.costUsedThisMonth / this.settings.monthlyBudgetInr) * 100;
    return Math.min(100, Math.max(0, pct));
  }

  /** Visual urgency colour for the budget bar. */
  get budgetBarColor(): 'ok' | 'warn' | 'critical' {
    const pct = this.budgetUsedPct;
    if (pct >= 90) return 'critical';
    if (pct >= 70) return 'warn';
    return 'ok';
  }

  // ── Audit log ─────────────────────────────────────────────

  loadLogs(): void {
    this.isLoadingLogs = true;
    this.api.getMySmsAuditLogs(this.pageIndex, this.pageSize).subscribe({
      next: (res) => {
        const data = res?.data as { content?: SmsAuditLogDto[]; totalElements?: number } | undefined;
        this.logs = data?.content ?? [];
        this.totalLogs = data?.totalElements ?? 0;
        this.isLoadingLogs = false;
      },
      error: () => {
        this.logs = [];
        this.isLoadingLogs = false;
      },
    });
  }

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.loadLogs();
  }

  // ── Test SMS ──────────────────────────────────────────────

  /** Whether the Send Test button is clickable right now. */
  canSendTest(): boolean {
    return this.features.smsEnabled()
        && !!this.testPhone.trim()
        && !this.isSendingTest;
  }

  sendTest(): void {
    if (!this.canSendTest()) return;
    this.isSendingTest = true;
    this.api.sendTestSms(this.testPhone.trim()).subscribe({
      next: () => {
        this.isSendingTest = false;
        this.snackBar.open(
          'Test SMS dispatched. Check your phone in a few seconds.',
          'OK', { duration: 5000 },
        );
        this.testPhone = '';
        // Refresh audit log so the test SMS shows up immediately
        this.loadLogs();
        this.loadSettings();
      },
      error: (err) => {
        this.isSendingTest = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to send test SMS',
          'Close', { duration: 5000 },
        );
      },
    });
  }

  // ── Today's absent students (manual SMS) ─────────────────

  /** Pull the picker from the backend. Pre-selects every student who has
   *  a valid phone AND wasn't already SMS'd today so the common case
   *  (admin clicks Load → Send) is one extra click. */
  loadAbsentToday(): void {
    this.isLoadingAbsent = true;
    this.api.listAbsentToday().subscribe({
      next: (res) => {
        this.absentToday = res?.data ?? [];
        // Default-select rows that are sendable: have a phone AND not
        // already sent today. Admin can flip checkboxes from there.
        const next = new Set<string>();
        for (const row of this.absentToday) {
          if (row.hasValidPhone && !row.alreadySent) next.add(row.studentId);
        }
        this.selectedAbsentIds = next;
        this.isLoadingAbsent = false;
      },
      error: (err) => {
        this.isLoadingAbsent = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to load today\'s absent students',
          'Close', { duration: 4000 },
        );
      },
    });
  }

  isAbsentSelected(studentId: string): boolean {
    return this.selectedAbsentIds.has(studentId);
  }

  toggleAbsentSelected(studentId: string, checked: boolean): void {
    if (checked) this.selectedAbsentIds.add(studentId);
    else         this.selectedAbsentIds.delete(studentId);
  }

  /** Header "Select all" checkbox state — true only when every sendable
   *  row is currently selected. Indeterminate states (some selected) are
   *  shown as unchecked here; we keep the API simple. */
  allAbsentSelected(): boolean {
    if (!this.absentToday || this.absentToday.length === 0) return false;
    const sendable = this.absentToday.filter(r => r.hasValidPhone && !r.alreadySent);
    if (sendable.length === 0) return false;
    return sendable.every(r => this.selectedAbsentIds.has(r.studentId));
  }

  toggleAllAbsent(checked: boolean): void {
    if (!this.absentToday) return;
    if (checked) {
      for (const r of this.absentToday) {
        if (r.hasValidPhone && !r.alreadySent) this.selectedAbsentIds.add(r.studentId);
      }
    } else {
      this.selectedAbsentIds.clear();
    }
  }

  /** Count summary shown above the list. */
  absentSummary(): { total: number; toSend: number; alreadySent: number; noPhone: number } {
    const rows = this.absentToday ?? [];
    return {
      total: rows.length,
      toSend: rows.filter(r => r.hasValidPhone && !r.alreadySent).length,
      alreadySent: rows.filter(r => r.alreadySent).length,
      noPhone: rows.filter(r => !r.hasValidPhone).length,
    };
  }

  /** Friendly label for the "absent in" column — e.g. "Whole day",
   *  "Period 2", "Periods 2, 4, 5". Keeps the table compact. */
  absentLabel(row: AbsentTodayDto): string {
    if (row.dayWise) return 'Whole day';
    const periods = row.absentPeriods ?? [];
    if (periods.length === 0) return '—';
    if (periods.length === 1) return `Period ${periods[0]}`;
    return 'Periods ' + periods.join(', ');
  }

  canSendAbsent(): boolean {
    return this.features.absenceAlertSms()
        && !this.isSendingAbsent
        && this.selectedAbsentIds.size > 0;
  }

  sendAbsentToday(): void {
    if (!this.canSendAbsent()) return;
    const ids = Array.from(this.selectedAbsentIds);

    const data: SmsConfirmData = {
      icon: 'event_busy',
      title: `Send absence SMS to ${ids.length} parent${ids.length === 1 ? '' : 's'}?`,
      audience: ids.length === 1
        ? 'The selected parent for today\'s absence'
        : `${ids.length} parents of students marked absent today`,
      recipientCount: ids.length,
      costPerSms: this.COST_PER_SMS,
      footnote:
        'Parents already SMS\'d earlier today are detected automatically and skipped — ' +
        'no duplicate charges. Students with no parent phone on record are skipped too.',
      confirmLabel: 'Send SMS',
    };

    this.dialog.open(SmsConfirmDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data,
      autoFocus: 'first-tabbable',
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.dispatchAbsentToday(ids);
    });
  }

  /** Extracted from sendAbsentToday so the confirm dialog observable
   *  doesn't hold the rest of the method captive. Pure dispatch. */
  private dispatchAbsentToday(ids: string[]): void {
    this.isSendingAbsent = true;
    this.api.sendAbsentTodaySms(ids).subscribe({
      next: (res) => {
        this.isSendingAbsent = false;
        const r = res?.data;
        const queued = r?.queued ?? 0;
        const skipDup = r?.skippedAlreadySent ?? 0;
        const skipNoPhone = r?.skippedNoPhone ?? 0;
        this.snackBar.open(
          `Queued ${queued} · ${skipDup} already sent · ${skipNoPhone} had no phone.`,
          'OK', { duration: 6000 },
        );
        // Refresh the picker (so the just-sent rows flip to "Already sent")
        // and the audit log + settings (cost counter ticks up).
        this.loadAbsentToday();
        this.loadLogs();
        this.loadSettings();
      },
      error: (err) => {
        this.isSendingAbsent = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to send absence SMS',
          'Close', { duration: 5000 },
        );
      },
    });
  }

  // ── Custom-notice broadcast ──────────────────────────────

  /** Template-friendly accessor — Angular's change detection runs
   *  isAudience(...) on every cycle, so the Set's `has` reflects the
   *  current checked state without needing a separate boolean per row. */
  isAudience(a: SmsBroadcastAudience): boolean {
    return this.broadcastAudiences.has(a);
  }

  /** Checkbox change handler — toggles the audience in the Set and
   *  lazy-loads the class list the first time CLASS is ticked. Clearing
   *  CLASS also clears the picked classId so the request stays honest. */
  toggleAudience(a: SmsBroadcastAudience, checked: boolean): void {
    if (checked) this.broadcastAudiences.add(a);
    else         this.broadcastAudiences.delete(a);

    if (a === 'CLASS') {
      if (checked && this.classes.length === 0 && !this.isLoadingClasses) {
        this.isLoadingClasses = true;
        this.api.getClasses().subscribe({
          next: (res) => {
            this.classes = res?.data ?? [];
            this.isLoadingClasses = false;
          },
          error: () => { this.isLoadingClasses = false; },
        });
      }
      if (!checked) this.broadcastClassId = '';
    }
  }

  /** Light validation gate for the Send button — full validation runs
   *  on the backend, but the user gets instant feedback for the
   *  common mistakes (no audience, empty body, CLASS without classId). */
  canSendBroadcast(): boolean {
    if (!this.features.customNoticeSms()) return false;
    if (this.isSendingBroadcast) return false;
    if (this.broadcastAudiences.size === 0) return false;
    const msg = this.broadcastMessage.trim();
    if (!msg || msg.length > this.BROADCAST_MAX) return false;
    if (this.broadcastAudiences.has('CLASS') && !this.broadcastClassId) return false;
    return true;
  }

  /** Human label for the chosen audience(s) — used in the confirm()
   *  dialog so the admin sees "all students' parents + all teachers"
   *  rather than raw enum names. Reads naturally for 1 or many picks. */
  audienceLabel(): string {
    if (this.broadcastAudiences.size === 0) return 'no one';
    const parts: string[] = [];
    if (this.broadcastAudiences.has('ALL'))           parts.push('everyone with a phone in the school');
    if (this.broadcastAudiences.has('ALL_STUDENTS'))  parts.push("all students' parents");
    if (this.broadcastAudiences.has('ALL_EMPLOYEES')) parts.push('all teachers, principal, and admins');
    if (this.broadcastAudiences.has('CLASS')) {
      const c = this.classes.find(x => x.classId === this.broadcastClassId);
      parts.push(c
        ? `parents of students in class "${c.name}"`
        : 'parents of students in the selected class');
    }
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  }

  sendBroadcast(): void {
    if (!this.canSendBroadcast()) return;

    // Recipient count for the broadcast isn't known upfront — the
    // backend resolves it from the audience picks. Show "estimated"
    // by audience description; the precise count comes back in the
    // success snackbar after the queue accepts.
    const data: SmsConfirmData = {
      icon: 'campaign',
      title: 'Send this custom SMS broadcast?',
      audience: this.audienceLabel(),
      messagePreview: this.broadcastMessage.trim(),
      // No precise count available pre-send; show 0 for "per-SMS" math
      // by using a single SMS as the unit — the dialog focus is on
      // audience + content review, not exact cost for broadcasts.
      recipientCount: 1,
      costPerSms: this.COST_PER_SMS,
      footnote:
        'Cost depends on how many phones MSG91 resolves from this audience. ' +
        'Each delivery costs approx ₹0.25. The exact recipient count appears ' +
        'in the success message after the broadcast is queued.',
      confirmLabel: 'Send broadcast',
    };

    this.dialog.open(SmsConfirmDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      data,
      autoFocus: 'first-tabbable',
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.dispatchBroadcast();
    });
  }

  /** Pure dispatch helper — extracted so the confirm observable doesn't
   *  swallow the sending state machine. */
  private dispatchBroadcast(): void {
    this.isSendingBroadcast = true;
    const req: SendCustomNoticeRequest = {
      audiences: Array.from(this.broadcastAudiences),
      message: this.broadcastMessage.trim(),
      ...(this.broadcastAudiences.has('CLASS') ? { classId: this.broadcastClassId } : {}),
    };
    this.api.sendCustomNoticeSms(req).subscribe({
      next: (res) => {
        this.isSendingBroadcast = false;
        const count = res?.data?.recipientCount ?? 0;
        this.snackBar.open(
          `Queued to ${count} recipient(s). Watch the audit log below for delivery status.`,
          'OK', { duration: 6000 },
        );
        // Clear the message so a double-click can't re-send the same body.
        // We keep the audience picks — admins often broadcast multiple
        // messages to the same group in a session (e.g. event reminders).
        this.broadcastMessage = '';
        // Re-load logs + settings — the new rows + cost counter show up
        this.loadLogs();
        this.loadSettings();
      },
      error: (err) => {
        this.isSendingBroadcast = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to send custom notice',
          'Close', { duration: 5000 },
        );
      },
    });
  }

  // ── Display helpers ───────────────────────────────────────

  formatDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  /** Map SMS status → chip colour class. */
  statusClass(status: string): string {
    switch (status) {
      case 'SENT':      return 'st-sent';
      case 'DELIVERED': return 'st-delivered';
      case 'FAILED':    return 'st-failed';
      case 'SKIPPED':   return 'st-skipped';
      case 'PENDING':   return 'st-pending';
      default:          return 'st-unknown';
    }
  }

  /** Map SMS trigger → friendly label. */
  triggerLabel(trigger: string): string {
    switch (trigger) {
      case 'ABSENCE_ALERT':   return 'Absence Alert';
      case 'RESULT_COMBINED': return 'Result (combined)';
      case 'RESULT_SINGLE':   return 'Result (subject)';
      case 'CUSTOM_NOTICE':   return 'Custom Notice';
      default:                return trigger;
    }
  }
}
