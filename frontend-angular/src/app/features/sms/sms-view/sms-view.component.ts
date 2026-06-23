import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { SmsConfirmDialogComponent, SmsConfirmData } from './sms-confirm-dialog.component';
import {
  ApiService,
  SmsAuditLogDto,
  TenantSmsSettingsDto,
  SendCustomNoticeRequest,
  SmsBroadcastAudience,
  AbsentTodayDto,
  SmsTemplateConfig,
  SmsTemplate,
  SmsTriggerKey,
  SmsAudience,
  SendHolidayNoticeRequest,
  SendResultNoticeRequest,
  ResultNoticeTarget,
  ConductedExamType,
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
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule, MatTableModule,
    MatChipsModule, MatCheckboxModule, MatPaginatorModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule, MatSnackBarModule,
    MatSelectModule, MatDialogModule, MatDatepickerModule,
    PageHeaderComponent,
  ],
  providers: [
    // Use Indian English locale for the date pickers so "9 May 2026" renders
    // in the format the school admins expect (matches our SMS body format too).
    { provide: MAT_DATE_LOCALE, useValue: 'en-IN' },
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
  readonly logColumns = ['createdAt', 'trigger', 'recipientPhone', 'sender', 'status', 'cost'];

  // ── Templates (read-only badges) ─────────────────────────
  /** Loaded once on init from /sms/templates — used by the templates card
   *  AND by the holiday-notice card to pull the body + sender for preview. */
  templates: SmsTemplateConfig | null = null;
  isLoadingTemplates = false;
  /** Static badge layout — order + title + icon for each trigger we surface.
   *  Keeps the template card declarative and easy to extend. */
  readonly templateBadges: ReadonlyArray<{ key: SmsTriggerKey; title: string; icon: string }> = [
    { key: 'ABSENCE_ALERT',   title: 'Absence Alert', icon: 'event_busy' },
    { key: 'HOLIDAY_NOTICE',  title: 'Holiday Notice', icon: 'beach_access' },
    { key: 'EVENT_NOTICE',    title: 'Event Notice',   icon: 'event' },
    { key: 'RESULT_COMBINED', title: 'Results',        icon: 'leaderboard' },
    { key: 'CUSTOM_NOTICE',   title: 'Custom Notice',  icon: 'campaign' },
  ];

  // ── Holiday-notice form ──────────────────────────────────
  /** Multi-audience picker, same shape as custom-notice. */
  holidayAudiences = new Set<SmsAudience>(['ALL_STUDENTS']);
  holidayClassId = '';
  holidayClosureDate: Date | null = null;
  holidayReopenDate: Date | null = null;
  holidayReason = '';
  isSendingHoliday = false;
  readonly HOLIDAY_REASON_MAX = 120;

  // Test SMS form
  testPhone = '';
  isSendingTest = false;

  // ── Publish Result SMS form ───────────────────────────────
  /** Conducted exam types loaded from /api/v1/sms/result-notice/exam-types.
   *  Each entry carries the (classId, sectionId) pairs the type appears
   *  in — drives BOTH the exam-type dropdown and the (narrowed) sections
   *  multi-select. Catalog types with no Exam docs drop out, so the
   *  picker only shows results the admin can actually publish. */
  conductedExamTypes: ConductedExamType[] = [];
  isLoadingExamTypes = false;
  /** Picked exam type (matches Exam.examType verbatim). Also doubles as
   *  the friendly exam-name fragment in var2 — the school's exam-type
   *  labels ("Unit Test 1", "Final Exam") are already SMS-ready, so the
   *  separate "Exam name" input got dropped. */
  resultExamTypeId = '';
  /** Multi-pick value bound to <mat-select multiple>. Stored as
   *  "classId::sectionId" string keys — same shape as the picker rows
   *  served by the conducted-exam-types endpoint so toggling between
   *  exam types just re-filters the available options. */
  resultPickedKeys: string[] = [];
  /** Cached section options shown in the multi-select. Recomputed only
   *  when {@link #resultExamTypeId} changes or one of the data sources
   *  (conducted exam types, class catalog) finishes loading. The
   *  template binds to this field rather than calling a method — a
   *  method call inside *ngFor would return a fresh array reference on
   *  every change-detection cycle, which causes Angular to re-render
   *  the dropdown options endlessly and freezes the page. */
  resultSectionOptions: { key: string; label: string }[] = [];
  isSendingResult = false;

  // ── Today's absent students (manual SMS) ─────────────────
  /** Loaded picker rows. Null = not loaded yet, [] = loaded but empty. */
  absentToday: AbsentTodayDto[] | null = null;
  /** Ticked studentIds — defaults to all unsent-with-phone rows after load.
   *  Survives class-filter changes so an admin can tick across classes
   *  before sending one batch SMS. */
  selectedAbsentIds = new Set<string>();
  isLoadingAbsent = false;
  isSendingAbsent = false;
  /** Class chip filter for the absentee table. 'ALL' shows every loaded
   *  row; otherwise rows whose {@link AbsentTodayDto.classLabel} matches
   *  the picked value. Pure UI state — no backend round-trip. */
  selectedAbsentClassFilter: string = 'ALL';

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
    this.loadTemplates();
    // Pre-load conducted exam types so the picker dropdowns render with
    // data on first scroll rather than waiting for a focus event.
    this.ensureResultCardData();
  }

  // ── Templates ─────────────────────────────────────────────

  /** Pull the tenant's read-only DLT-approved templates. Used by the
   *  "Available templates" card AND as the source of the Holiday Notice
   *  preview body + sender pill. One round-trip on page open. */
  loadTemplates(): void {
    this.isLoadingTemplates = true;
    this.api.getMySmsTemplates().subscribe({
      next: (res) => {
        this.templates = res?.data ?? {};
        this.isLoadingTemplates = false;
      },
      error: () => {
        this.templates = {};
        this.isLoadingTemplates = false;
      },
    });
  }

  /** A template counts as "ready" only when BOTH templateId AND senderId
   *  are present — MSG91 rejects the send otherwise. */
  isTemplateReady(t: SmsTemplate | undefined): boolean {
    return !!(t && t.templateId && t.senderId);
  }

  /** Template lookup helper — used by the badges card. Angular's template
   *  parser doesn't love optional-chained bracket indexing, so a tiny
   *  helper keeps the template clean. */
  templateFor(key: SmsTriggerKey): SmsTemplate | undefined {
    return this.templates ? this.templates[key] : undefined;
  }

  /** Convenience for the holiday card — null when missing. */
  get holidayTemplate(): SmsTemplate | undefined {
    return this.templates?.HOLIDAY_NOTICE;
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

  /** Distinct class labels in the loaded absentee set, sorted naturally
   *  (numeric-aware) so "1-A" comes before "10-A" and LKG/UKG bubble up.
   *  Drives the chip filter row above the table. */
  absentClassLabels(): string[] {
    if (!this.absentToday) return [];
    const set = new Set<string>();
    for (const r of this.absentToday) {
      if (r.classLabel) set.add(r.classLabel);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /** Visible rows after the class chip filter. Drives the table render
   *  and every "select all / summary / send" helper below. */
  filteredAbsentToday(): AbsentTodayDto[] {
    if (!this.absentToday) return [];
    if (this.selectedAbsentClassFilter === 'ALL') return this.absentToday;
    return this.absentToday.filter(r => r.classLabel === this.selectedAbsentClassFilter);
  }

  isAbsentSelected(studentId: string): boolean {
    return this.selectedAbsentIds.has(studentId);
  }

  toggleAbsentSelected(studentId: string, checked: boolean): void {
    if (checked) this.selectedAbsentIds.add(studentId);
    else         this.selectedAbsentIds.delete(studentId);
  }

  /** Header "Select all" checkbox state — true only when every sendable
   *  row in the CURRENT FILTER is selected. With "All" picked this is the
   *  whole loaded set; with a class chip active it's just that class's
   *  sendable rows. Indeterminate states (some selected) are shown as
   *  unchecked here; we keep the API simple. */
  allAbsentSelected(): boolean {
    const rows = this.filteredAbsentToday();
    if (rows.length === 0) return false;
    const sendable = rows.filter(r => r.hasValidPhone && !r.alreadySent);
    if (sendable.length === 0) return false;
    return sendable.every(r => this.selectedAbsentIds.has(r.studentId));
  }

  /** Tick / untick every sendable row in the current filter. Untouched
   *  rows outside the filter keep their ticked state — admin can chip-hop
   *  across classes and accumulate a multi-class selection. */
  toggleAllAbsent(checked: boolean): void {
    const rows = this.filteredAbsentToday();
    if (checked) {
      for (const r of rows) {
        if (r.hasValidPhone && !r.alreadySent) this.selectedAbsentIds.add(r.studentId);
      }
    } else {
      for (const r of rows) this.selectedAbsentIds.delete(r.studentId);
    }
  }

  /** Count summary shown above the list. Numbers reflect the current
   *  filter — so an admin scoping to 10-C sees "5 absent · 5 to notify"
   *  instead of the school-wide total that makes scope-bound batches
   *  confusing. */
  absentSummary(): { total: number; toSend: number; alreadySent: number; noPhone: number } {
    const rows = this.filteredAbsentToday();
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

  // ── Holiday-notice broadcast ─────────────────────────────

  /** Same toggle semantics as custom-notice; lazy-loads class list when
   *  CLASS is ticked for the first time. Shares the {@code classes}
   *  field with the custom-notice card. */
  isHolidayAudience(a: SmsAudience): boolean {
    return this.holidayAudiences.has(a);
  }

  toggleHolidayAudience(a: SmsAudience, checked: boolean): void {
    if (checked) this.holidayAudiences.add(a);
    else         this.holidayAudiences.delete(a);

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
      if (!checked) this.holidayClassId = '';
    }
  }

  /** Format a Date in the "9 May 2026" shape the DLT-approved template
   *  body expects. Empty string when null so substitution is safe. */
  formatHolidayDate(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  /** Render the loaded HOLIDAY_NOTICE template body with the typed values
   *  substituted in order ({#var#} → closureDate, reason, reopenDate).
   *  Unfilled slots get [Closure date], [Reason], [Reopen date] so the
   *  admin sees exactly where each value lands. */
  holidayPreview(): string {
    const tpl = this.holidayTemplate?.body;
    if (!tpl) return 'Holiday template not configured.';
    const closure  = this.formatHolidayDate(this.holidayClosureDate) || '[Closure date]';
    const reason   = this.holidayReason.trim() || '[Reason]';
    const reopen   = this.formatHolidayDate(this.holidayReopenDate)  || '[Reopen date]';
    const values = [closure, reason, reopen];
    let i = 0;
    return tpl.replace(/\{#var#\}/g, () => values[i++] ?? '');
  }

  /** Sender displayed in the small pill. "—" when missing. */
  holidaySender(): string {
    return this.holidayTemplate?.senderId || '—';
  }

  /** Send-button gate — feature on, template ready, trigger ticked in
   *  tenant settings, audience picked (CLASS implies classId), all
   *  three structured fields filled, not already sending. */
  canSendHoliday(): boolean {
    if (!this.features.smsEnabled()) return false;
    if (this.isSendingHoliday) return false;
    if (!this.settings?.holidayNoticeEnabled) return false;
    if (!this.isTemplateReady(this.holidayTemplate)) return false;
    if (this.holidayAudiences.size === 0) return false;
    if (this.holidayAudiences.has('CLASS') && !this.holidayClassId) return false;
    if (!this.holidayClosureDate || !this.holidayReopenDate) return false;
    const reason = this.holidayReason.trim();
    if (!reason || reason.length > this.HOLIDAY_REASON_MAX) return false;
    return true;
  }

  /** Audience summary for the confirm dialog. Same vocabulary as the
   *  custom-notice audienceLabel() — kept as a separate method since the
   *  enum-to-prose mapping is identical but the source Set differs. */
  holidayAudienceLabel(): string {
    if (this.holidayAudiences.size === 0) return 'no one';
    const parts: string[] = [];
    if (this.holidayAudiences.has('ALL'))           parts.push('everyone with a phone in the school');
    if (this.holidayAudiences.has('ALL_STUDENTS'))  parts.push("all students' parents");
    if (this.holidayAudiences.has('ALL_EMPLOYEES')) parts.push('all teachers, principal, and admins');
    if (this.holidayAudiences.has('CLASS')) {
      const c = this.classes.find(x => x.classId === this.holidayClassId);
      parts.push(c
        ? `parents of students in class "${c.name}"`
        : 'parents of students in the selected class');
    }
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  }

  sendHoliday(): void {
    if (!this.canSendHoliday()) return;

    const data: SmsConfirmData = {
      icon: 'beach_access',
      title: 'Send this holiday notice?',
      audience: this.holidayAudienceLabel(),
      messagePreview: this.holidayPreview(),
      recipientCount: 1,
      costPerSms: this.COST_PER_SMS,
      footnote:
        'Cost depends on how many phones MSG91 resolves from this audience. ' +
        'Each delivery costs approx ₹0.25. The exact recipient count appears ' +
        'in the success message after the broadcast is queued.',
      confirmLabel: 'Send holiday notice',
    };

    this.dialog.open(SmsConfirmDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      data,
      autoFocus: 'first-tabbable',
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.dispatchHoliday();
    });
  }

  private dispatchHoliday(): void {
    this.isSendingHoliday = true;
    const req: SendHolidayNoticeRequest = {
      audiences: Array.from(this.holidayAudiences),
      closureDate: this.formatHolidayDate(this.holidayClosureDate),
      reopenDate:  this.formatHolidayDate(this.holidayReopenDate),
      reason: this.holidayReason.trim(),
      ...(this.holidayAudiences.has('CLASS') ? { classId: this.holidayClassId } : {}),
    };
    this.api.sendHolidayNoticeSms(req).subscribe({
      next: (res) => {
        this.isSendingHoliday = false;
        const count = res?.data?.recipientCount ?? 0;
        this.snackBar.open(
          `Holiday notice queued to ${count} recipient(s). Watch the audit log below for delivery status.`,
          'OK', { duration: 6000 },
        );
        // Clear the structured fields so a stray double-click can't re-send.
        // Audience picks are sticky — admins often send multiple notices to
        // the same group during a planning session.
        this.holidayClosureDate = null;
        this.holidayReopenDate = null;
        this.holidayReason = '';
        this.loadLogs();
        this.loadSettings();
      },
      error: (err) => {
        this.isSendingHoliday = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to send holiday notice',
          'Close', { duration: 5000 },
        );
      },
    });
  }

  // ── Publish Result SMS ────────────────────────────────────

  /** Lazy-load both the conducted exam types AND the tenant's class
   *  catalog. The classes feed the section multi-select's fallback path
   *  (used when the picked exam type has no sectionId on its Exam docs —
   *  legacy data, class-wide exams). Cheap when called again — guarded
   *  by the isLoading flags. */
  ensureResultCardData(): void {
    if (this.conductedExamTypes.length === 0 && !this.isLoadingExamTypes) {
      this.isLoadingExamTypes = true;
      this.api.getConductedResultExamTypes().subscribe({
        next: (res) => {
          this.conductedExamTypes = res?.data ?? [];
          this.isLoadingExamTypes = false;
          this.recomputeResultSectionOptions();
        },
        error: () => {
          this.conductedExamTypes = [];
          this.isLoadingExamTypes = false;
        },
      });
    }
    if (this.classes.length === 0 && !this.isLoadingClasses) {
      this.isLoadingClasses = true;
      this.api.getClasses().subscribe({
        next: (res) => {
          this.classes = res?.data ?? [];
          this.isLoadingClasses = false;
          // Class catalog feeds the fallback section list — recompute
          // so a picked-but-unnarrowed exam type gets its options.
          this.recomputeResultSectionOptions();
        },
        error: () => { this.isLoadingClasses = false; },
      });
    }
  }

  /** Rebuild {@link #resultSectionOptions} from the current inputs.
   *  Called only on real input changes (exam type picked, data loaded)
   *  — NOT from the template. The template binds to the field directly
   *  to keep array identity stable across change-detection cycles.
   *
   *  Two-tier resolution:
   *
   *  1. Preferred: the picked exam type's narrowed (classId, sectionId)
   *     list — only sections that actually have exams of that type.
   *
   *  2. Fallback: every (classId, sectionId) in the tenant's class
   *     catalog. Kicks in when the picked exam type's Exam docs lack
   *     classId / sectionId (legacy or class-wide exams) — admin can
   *     still target whichever section actually sat the exam. */
  private recomputeResultSectionOptions(): void {
    if (!this.resultExamTypeId) {
      this.resultSectionOptions = [];
      return;
    }
    const bucket = this.conductedExamTypes.find(
      e => e.examType === this.resultExamTypeId,
    );
    const narrowed = bucket?.sections ?? [];
    if (narrowed.length > 0) {
      this.resultSectionOptions = narrowed.map(s => ({
        key: `${s.classId}::${s.sectionId}`,
        label: this.sectionDisplayLabel(s.classLabel, s.sectionLabel),
      }));
      return;
    }
    // Fallback — flatten every class+section in the tenant.
    const all: { key: string; label: string }[] = [];
    for (const c of this.classes) {
      if (!c.sections) continue;
      for (const s of c.sections) {
        all.push({
          key: `${c.classId}::${s.sectionId}`,
          label: this.sectionDisplayLabel(c.name, s.name),
        });
      }
    }
    this.resultSectionOptions = all;
  }

  /** trackBy for the section multi-select — keeps DOM stable across
   *  the rare full-array swaps (e.g. classes load after exam types). */
  trackByResultSectionKey(_index: number, row: { key: string }): string {
    return row.key;
  }

  /** "1st A" when both pieces are present; falls back gracefully. */
  private sectionDisplayLabel(classLabel?: string, sectionLabel?: string): string {
    const c = (classLabel ?? '').trim();
    const s = (sectionLabel ?? '').trim();
    if (c && s) return `${c} - ${s}`;
    if (c) return c;
    if (s) return s;
    return 'Section';
  }

  /** Wipe section picks when the exam type changes — the previously
   *  picked keys may not even be valid options under the new type —
   *  and recompute the cached section list for the new pick. */
  onResultExamTypeChange(): void {
    this.resultPickedKeys = [];
    this.recomputeResultSectionOptions();
  }

  /** True for the RESULT_COMBINED template — drives the disabled-button
   *  warning that explains why Send is greyed out. */
  get resultTemplate(): SmsTemplate | undefined {
    return this.templates?.RESULT_COMBINED;
  }

  resultSender(): string {
    return this.resultTemplate?.senderId || '—';
  }

  /** Send-button gate — feature on, template ready, trigger ticked in
   *  tenant settings, exam type picked, at least one section picked. */
  canSendResult(): boolean {
    if (!this.features.smsEnabled()) return false;
    if (this.isSendingResult) return false;
    if (!this.settings?.resultPublishEnabled) return false;
    if (!this.isTemplateReady(this.resultTemplate)) return false;
    if (!this.resultExamTypeId) return false;
    if (this.resultPickedKeys.length === 0) return false;
    return true;
  }

  /** Human-readable summary of the picked sections — used in the confirm
   *  dialog so the admin sees exactly which sections will get SMS'd.
   *  Caps at 4 entries with "… +N more" to stay readable. */
  resultScopeLabel(): string {
    if (this.resultPickedKeys.length === 0) return 'no sections';
    const labelByKey = new Map<string, string>();
    for (const row of this.resultSectionOptions) {
      labelByKey.set(row.key, row.label);
    }
    const parts = this.resultPickedKeys
      .map(k => labelByKey.get(k) || k)
      .slice(0, 4);
    let out = parts.join(' · ');
    if (this.resultPickedKeys.length > 4) {
      out += ` · +${this.resultPickedKeys.length - 4} more`;
    }
    return out;
  }

  sendResult(): void {
    if (!this.canSendResult()) return;

    const data: SmsConfirmData = {
      icon: 'leaderboard',
      title: 'Send the result SMS to these sections?',
      audience: this.resultScopeLabel(),
      messagePreview:
        `Each parent gets a body shaped like:\n\n` +
        `"Dear Parent, <Student> of <Class Section> in ${this.resultExamTypeId} ` +
        `secured <Eng 80/100, Math 85/100, … Total X/Y (Z%)> in the recent exams. ` +
        `Detailed marksheet available at Website/Application. - <School>"\n\n` +
        `Phone numbers come from parent phone on the student record + ` +
        `linked parent accounts (deduped per phone).`,
      recipientCount: 1,
      costPerSms: this.COST_PER_SMS,
      footnote:
        'One SMS per student — students with no parent phone on record are ' +
        'skipped and reported back. Each delivery costs approx ₹0.25.',
      confirmLabel: 'Send result SMS',
    };

    this.dialog.open(SmsConfirmDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      data,
      autoFocus: 'first-tabbable',
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.dispatchResult();
    });
  }

  /** Map the picked keys back into the request shape, then dispatch. */
  private dispatchResult(): void {
    this.isSendingResult = true;

    const targets: ResultNoticeTarget[] = [];
    for (const key of this.resultPickedKeys) {
      const [classId, sectionId] = key.split('::');
      if (classId && sectionId) targets.push({ classId, sectionId });
    }

    // examName omitted — backend falls back to examType (already a
    // friendly label like "Unit Test 1"). One less field for the admin
    // to retype.
    const req: SendResultNoticeRequest = {
      examType: this.resultExamTypeId,
      targets,
    };
    this.api.sendResultNoticeSms(req).subscribe({
      next: (res) => {
        this.isSendingResult = false;
        const d = res?.data;
        const recipients = d?.recipientCount ?? 0;
        const students   = d?.studentsCovered ?? 0;
        const skipped    = d?.skippedNoPhone ?? 0;
        const sections   = d?.sectionsCovered ?? 0;
        this.snackBar.open(
          `Queued ${recipients} SMS for ${students} student(s) across ${sections} section(s)` +
          (skipped > 0 ? ` · ${skipped} had no parent phone` : ''),
          'OK', { duration: 7000 },
        );
        // Reset picks so a stray double-click can't re-send. Exam type
        // stays — admins often broadcast multiple sections in a row.
        this.resultPickedKeys = [];
        this.loadLogs();
        this.loadSettings();
      },
      error: (err) => {
        this.isSendingResult = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to send result SMS',
          'Close', { duration: 6000 },
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
      case 'HOLIDAY_NOTICE':  return 'Holiday Notice';
      case 'EVENT_NOTICE':    return 'Event Notice';
      default:                return trigger;
    }
  }
}
