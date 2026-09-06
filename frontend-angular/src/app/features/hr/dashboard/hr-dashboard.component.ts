import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, Subscription } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  FeatureKey,
  EmployeeAttendance,
  HrDailyAttendance,
  HrEmployeeOption,
  RegularizationRequest,
  User,
} from '../../../core/models';

/**
 * Landing page for HR users.
 *
 * <p>The page is truly a <em>dashboard</em> — it surfaces the state
 * of the HR module at a glance, not just a link menu. Content order:</p>
 * <ol>
 *   <li>Compact hero strip — the HR user's own IN/OUT punch in one
 *       row so their personal workday is one tap from the entry
 *       point.</li>
 *   <li>Today-at-a-glance KPI grid — employee count, marked, on
 *       the clock now, late, half-day, pending approvals.</li>
 *   <li>Two panels side-by-side — <b>Live activity</b> (recent
 *       punches, newest first) and <b>Pending approvals</b>
 *       (top 5 requests HR still needs to review).</li>
 *   <li>Sub-feature quick-nav chips at the bottom — smaller than
 *       the earlier full tiles because the KPIs now dominate.</li>
 * </ol>
 */
interface QuickChip {
  featureKey: FeatureKey;
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

/** One card in the KPI grid. Renders <value>/<hint> under a coloured
 *  icon block. Routing is optional — a stat that doesn't map to a
 *  drill-down (e.g. "Total employees") stays inert. */
interface KpiCard {
  key: string;
  label: string;
  value: number | string;
  hint?: string;
  icon: string;
  tone: 'gold' | 'green' | 'blue' | 'purple' | 'amber' | 'red';
  route?: string;
  ariaBusy?: boolean;
}

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-dashboard.component.html',
  styleUrl: './hr-dashboard.component.scss',
})
export class HrDashboardComponent implements OnInit, OnDestroy {

  currentUser: User | null = null;
  today: EmployeeAttendance | null = null;
  todayIso = this.formatDateLocal(new Date());

  // ── Stats state ──────────────────────────────────
  employees: HrEmployeeOption[] = [];
  todayRows: HrDailyAttendance[] = [];
  pendingRequests: RegularizationRequest[] = [];

  isLoadingStats = false;
  private statsSub?: Subscription;

  /** Live re-tick so the "on work Nm ago" hints on the activity
   *  panel stay current without a full refetch. Ticks every minute. */
  private tickId?: ReturnType<typeof setInterval>;
  nowMs = Date.now();

  /** Small chip nav at the bottom — same feature-flag lens as before
   *  but rendered as compact chips instead of hero tiles now that
   *  the dashboard has real content above. */
  readonly allChips: QuickChip[] = [
    { featureKey: 'hr_attendance', label: 'Daily Attendance', icon: 'event_available', route: '/hr/attendance/daily' },
    { featureKey: 'hr_attendance', label: 'Approvals',        icon: 'pending_actions', route: '/hr/attendance/approvals' },
    { featureKey: 'hr_attendance', label: 'Settings',         icon: 'tune',            route: '/hr/attendance/settings' },
  ];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.loadPersonalPunch();
    if (this.isEnabled('hr_attendance')) {
      this.loadStats();
    }
    // Refresh "N minutes ago" copy every minute; skips the network.
    this.tickId = setInterval(() => (this.nowMs = Date.now()), 60_000);
  }

  ngOnDestroy(): void {
    this.statsSub?.unsubscribe();
    if (this.tickId) clearInterval(this.tickId);
  }

  // ── Data loads ───────────────────────────────────

  private loadPersonalPunch(): void {
    this.api.hrMyAttendance().subscribe({
      next: (res) => {
        const rows = res.data || [];
        this.today = rows.find(r => r.date === this.todayIso) || null;
      },
    });
  }

  /** Fetches the three inputs the KPI grid + panels need in parallel:
   *  today's punches, the employee roster, and pending approvals.
   *  Uses forkJoin so the panels arrive together — avoids a flicker
   *  where KPIs update in three staggered steps. */
  private loadStats(): void {
    this.isLoadingStats = true;
    this.statsSub = forkJoin({
      today: this.api.hrDailyAttendance(this.todayIso),
      employees: this.api.hrListEmployees(),
      pending: this.api.hrPendingRegularizations(),
    }).subscribe({
      next: (res) => {
        this.todayRows = res.today.data || [];
        this.employees = res.employees.data || [];
        this.pendingRequests = res.pending.data || [];
        this.isLoadingStats = false;
      },
      error: () => { this.isLoadingStats = false; },
    });
  }

  // ── Derived KPI values ──────────────────────────

  get kpis(): KpiCard[] {
    const total = this.employees.length;
    // Punched-in today = any row with an inTime. Excludes rows that
    // are pure REGULARIZATION carry-ins with no IN stamped yet.
    const marked = this.todayRows.filter(r => !!r.inTime).length;
    const onClock = this.todayRows.filter(r => r.inTime && !r.outTime).length;
    const lateToday = this.todayRows.filter(r => r.late).length;
    const halfDayToday = this.todayRows.filter(r => r.status === 'HALF_DAY').length;
    // "Not marked" = a proxy for absent that doesn't hard-flag people
    // as absent mid-day. Only shown when it's a meaningful count.
    const notMarked = Math.max(0, total - marked);

    return [
      { key: 'total',   label: 'Total employees',  value: total,
        icon: 'groups',           tone: 'blue',
        hint: 'On the HR roster' },
      { key: 'marked',  label: 'Marked today',     value: `${marked}/${total || 0}`,
        icon: 'how_to_reg',       tone: 'green',
        hint: total ? `${Math.round((marked / total) * 100)}% turnout` : undefined },
      { key: 'onclock', label: 'On the clock now', value: onClock,
        icon: 'schedule',         tone: 'gold',
        hint: 'IN without OUT' },
      { key: 'late',    label: 'Late arrivals',    value: lateToday,
        icon: 'alarm',            tone: 'amber',
        hint: 'Past the late threshold' },
      { key: 'halfday', label: 'Half-day today',   value: halfDayToday,
        icon: 'hourglass_top',    tone: 'purple' },
      { key: 'pending', label: 'Pending approvals',value: this.pendingRequests.length,
        icon: 'pending_actions',  tone: 'red',
        route: '/hr/attendance/approvals',
        hint: this.pendingRequests.length ? 'Needs your review' : 'All caught up' },
    ];
  }

  /** Newest-first slice of today's rows for the activity panel. Uses
   *  outTime when present (an OUT is fresher signal than an old IN),
   *  falling back to inTime. Capped to 6 rows so the panel doesn't
   *  become a scroll trap. */
  get recentActivity(): HrDailyAttendance[] {
    return [...this.todayRows]
      .filter(r => r.inTime || r.outTime)
      .sort((a, b) => {
        const ta = new Date(a.outTime || a.inTime || 0).getTime();
        const tb = new Date(b.outTime || b.inTime || 0).getTime();
        return tb - ta;
      })
      .slice(0, 6);
  }

  get pendingPanelTop(): RegularizationRequest[] {
    return this.pendingRequests.slice(0, 4);
  }

  // ── Formatters ──────────────────────────────────

  activityLabel(r: HrDailyAttendance): string {
    return r.outTime ? 'OUT' : 'IN';
  }

  activityTimeIso(r: HrDailyAttendance): string | undefined {
    return r.outTime || r.inTime;
  }

  activityAgo(r: HrDailyAttendance): string {
    const iso = this.activityTimeIso(r);
    if (!iso) return '';
    const diffMin = Math.max(0, Math.floor((this.nowMs - new Date(iso).getTime()) / 60_000));
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return h < 24 ? `${h}h ${m}m ago` : this.formatRowTime(iso);
  }

  formatRowTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN',
      { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatRequestDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN',
      { day: '2-digit', month: 'short' });
  }

  initials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // ── Feature-flag lens ───────────────────────────

  isEnabled(key: FeatureKey): boolean {
    if (this.auth.isSuperAdmin) return true;
    return this.auth.isFeatureEnabled(key);
  }

  get visibleChips(): QuickChip[] {
    return this.allChips
      .filter(c => this.isEnabled(c.featureKey))
      .map(c => c.route === '/hr/attendance/approvals'
        ? { ...c, badge: this.pendingRequests.length }
        : c);
  }

  // ── Personal punch strip ────────────────────────

  get welcomeName(): string {
    const u = this.currentUser;
    if (!u) return '';
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return full || u.username || 'there';
  }

  get workStatusLine(): string {
    if (!this.today) return 'Yet to start work today.';
    if (!this.today.outTime) return `Work started at ${this.formatRowTime(this.today.inTime)}`;
    return `Done — IN ${this.formatRowTime(this.today.inTime)} · OUT ${this.formatRowTime(this.today.outTime)}`;
  }

  get canPunch(): boolean {
    if (!this.today) return true;
    if (!this.today.outTime) return true;
    return false;
  }

  get bigButtonLabel(): string {
    if (!this.today) return 'Start Workday';
    if (!this.today.outTime) return 'End Workday';
    return 'Done for today';
  }

  get bigButtonIcon(): string {
    if (!this.today) return 'login';
    if (!this.today.outTime) return 'logout';
    return 'verified';
  }

  goToMarkPage(): void {
    this.router.navigate(['/hr/attendance/mark']);
  }

  // ── Utility ─────────────────────────────────────

  private formatDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
