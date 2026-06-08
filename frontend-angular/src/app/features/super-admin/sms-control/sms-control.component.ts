import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ApiService,
  TenantSmsSettingsDto,
  UpdateTenantSmsSettingsRequest,
  SmsTemplateConfig,
  SmsTriggerKey,
} from '../../../core/services/api.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EnableTenantSmsDialogComponent } from './enable-tenant-sms-dialog.component';
import { TenantTemplatesPanelComponent } from './tenant-templates-panel/tenant-templates-panel.component';

/**
 * Super Admin SMS Control Panel. Single-page dashboard where the
 * platform owner (Vincent Thrives) decides which tenants get SMS,
 * which triggers are active, and what their monthly budget caps are.
 *
 * UX:
 *   - One row per tenant with inline toggles
 *   - Every toggle PATCHes the backend immediately (no Save button)
 *   - Optimistic UI — toggle flips locally, snackbar confirms,
 *     rollback on error
 *   - Search/filter for large tenant lists
 *   - Expandable detail row reveals the per-tenant templates editor
 *
 * Authorisation is enforced at the backend (SUPER_ADMIN role); this
 * component assumes the user already passed the super-admin route guard.
 */
@Component({
  selector: 'app-sms-control',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatTableModule, MatSlideToggleModule, MatCheckboxModule,
    MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule,
    MatSelectModule, MatMenuModule, MatDialogModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    PageHeaderComponent,
    TenantTemplatesPanelComponent,
  ],
  templateUrl: './sms-control.component.html',
  styleUrl: './sms-control.component.scss',
})
export class SmsControlComponent implements OnInit {
  /** Full list — what the backend returned. Filters narrow what's displayed. */
  tenants: TenantSmsSettingsDto[] = [];

  /** tenantId → schoolName map, loaded in parallel from /super/tenants so
   *  the table shows "Springfield International School" instead of the
   *  raw UUID. Missing entries (tenant deleted but settings row still
   *  exists) fall back to displaying the id. */
  tenantNames = new Map<string, string>();

  /** Free-text search box content. */
  searchQuery = '';

  /** "all" | "enabled" | "disabled" filter dropdown. */
  filterMode: 'all' | 'enabled' | 'disabled' = 'all';

  isLoading = false;

  /** Set of tenantIds currently being saved — for spinner UX. */
  saving = new Set<string>();

  /** Currently expanded tenant row, or null when no row is expanded. */
  expandedTenantId: string | null = null;

  /** Per-tenant template cache. Populated lazily the first time a row is
   *  expanded so we can render the "configured" dots on the trigger
   *  checkboxes without an N+1 lookup at page load. */
  templatesByTenant = new Map<string, SmsTemplateConfig>();

  readonly displayedColumns = [
    'expand', 'tenantId', 'enabled',
    'absenceAlert', 'resultPublish', 'customNotice', 'holidayNotice',
    'budget', 'usage', 'updatedAt', 'actions',
  ];

  /** Single-column row def used for the expanded detail row. */
  readonly expandedColumns = ['expandedDetail'];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  /** Opens the "Enable SMS for a tenant" picker dialog. The dialog
   *  fetches the full tenant list from /api/v1/super/tenants and lets
   *  the super admin pick a school that doesn't yet have SMS settings.
   *  On confirm, the dialog returns the picked tenantId and we run
   *  the same patch() flow with enabled=true + sensible defaults. */
  openEnableDialog(): void {
    const existingIds = new Set(this.tenants.map(t => t.tenantId));
    const ref = this.dialog.open(EnableTenantSmsDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data: { existingTenantIds: existingIds },
    });
    ref.afterClosed().subscribe((tenantId: string | undefined) => {
      if (!tenantId) return;
      // Default sensible config when first enabling: master ON + absence
      // trigger ON, others off. Super admin can fine-tune from the table.
      this.api.updateTenantSmsSettings(tenantId, {
        enabled: true,
        absenceAlertEnabled: true,
        resultPublishEnabled: false,
        customNoticeEnabled: false,
        monthlyBudgetInr: 2000,
      }).subscribe({
        next: (res) => {
          if (res?.data) this.tenants = [res.data, ...this.tenants];
          this.snackBar.open(`SMS enabled for ${tenantId}`, 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || `Failed to enable SMS for ${tenantId}`,
            'Close', { duration: 4000 },
          );
        },
      });
    });
  }

  ngOnInit(): void {
    this.load();
    this.loadTenantNames();
  }

  load(): void {
    this.isLoading = true;
    this.api.getAllTenantSmsSettings().subscribe({
      next: (res) => {
        this.tenants = res?.data ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load SMS settings', 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  /** Fetch the full tenant list once and build a tenantId → schoolName
   *  map. Drives the human-readable column in the table. We fetch up to
   *  500 tenants in one shot — well above any realistic platform size
   *  for the near term; if you ever push past that, swap to chunked
   *  fetches keyed by the tenantIds present in {@link tenants}. */
  private loadTenantNames(): void {
    this.api.getTenants(0, 500).subscribe({
      next: (res) => {
        const list = (res?.data as { content?: { tenantId: string; schoolName: string }[] } | undefined)?.content ?? [];
        this.tenantNames = new Map(list.map(t => [t.tenantId, t.schoolName]));
      },
      // No snackbar on error — names are nice-to-have, table still works
      // by falling back to the tenantId.
      error: () => { /* swallow */ },
    });
  }

  /** Resolve the human-readable name for a tenant row. */
  displayName(tenantId: string): string {
    return this.tenantNames.get(tenantId) || tenantId;
  }

  /** Toggle handler shared by every checkbox/slide-toggle column.
   *  Patches just the field that changed — minimal payload, easy
   *  to reason about, and matches the per-toggle UX. */
  patch(tenant: TenantSmsSettingsDto, patch: UpdateTenantSmsSettingsRequest): void {
    this.saving.add(tenant.tenantId);
    this.api.updateTenantSmsSettings(tenant.tenantId, patch).subscribe({
      next: (res) => {
        this.saving.delete(tenant.tenantId);
        // Replace the row with the canonical version returned by backend
        Object.assign(tenant, res?.data ?? tenant);
        this.snackBar.open('Saved', 'Close', { duration: 1500 });
      },
      error: (err) => {
        this.saving.delete(tenant.tenantId);
        // Revert the optimistic flip by reloading. Cheap and correct.
        this.load();
        this.snackBar.open(
          err?.error?.message || 'Failed to update settings',
          'Close', { duration: 4000 },
        );
      },
    });
  }

  /** Hard-delete a tenant's SMS settings row.
   *
   *  Distinct from flipping the master toggle off — DELETE removes the
   *  document entirely, so the row vanishes from the table and the
   *  tenant returns to the default "no SMS settings exist" state. Useful
   *  for off-boarding a school and for cleaning up orphan rows (the
   *  underlying tenant was deleted but its SMS settings linger).
   *
   *  Uses a plain confirm() rather than a Material dialog — quick, blocks
   *  the click thread, and the action is reversible (Super Admin can
   *  re-enable via "+ Enable for tenant" any time). Worth a dialog only
   *  if we add a "type the tenantId to confirm" gate later. */
  onDelete(tenant: TenantSmsSettingsDto): void {
    const label = this.displayName(tenant.tenantId);
    const ok = window.confirm(
      `Delete SMS settings for "${label}"?\n\n` +
      `This removes the settings row and turns SMS off for them. ` +
      `Their past audit logs are preserved. You can re-enable later.`,
    );
    if (!ok) return;

    this.saving.add(tenant.tenantId);
    this.api.deleteTenantSmsSettings(tenant.tenantId).subscribe({
      next: () => {
        this.saving.delete(tenant.tenantId);
        // Optimistically splice the row out so the table updates instantly.
        // (load() would work too but causes a brief flicker on slow networks.)
        this.tenants = this.tenants.filter(t => t.tenantId !== tenant.tenantId);
        // Drop any expansion/cache state pinned to the removed tenant.
        if (this.expandedTenantId === tenant.tenantId) this.expandedTenantId = null;
        this.templatesByTenant.delete(tenant.tenantId);
        this.snackBar.open(`Deleted SMS settings for ${label}`, 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.saving.delete(tenant.tenantId);
        this.snackBar.open(
          err?.error?.message || `Failed to delete SMS settings for ${label}`,
          'Close', { duration: 4000 },
        );
      },
    });
  }

  /** Triggered when the school admin types in the budget input.
   *  Debounce isn't worth it — typing is rare and saving on blur
   *  is fine via the (change) event in the template. */
  saveBudget(tenant: TenantSmsSettingsDto, raw: string): void {
    const num = Number(raw);
    if (isNaN(num) || num < 0) {
      this.snackBar.open('Budget must be a non-negative number', 'Close', { duration: 3000 });
      return;
    }
    this.patch(tenant, { monthlyBudgetInr: num });
  }

  /** Lightweight client-side filter — keeps the table snappy without
   *  needing a backend search endpoint (we expect tens of tenants
   *  initially, not thousands). */
  get filtered(): TenantSmsSettingsDto[] {
    let rows = this.tenants;
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      // Match either the school name (most common) or the raw tenantId
      // (handy when pasting an id from logs/Mongo).
      rows = rows.filter(t =>
        t.tenantId.toLowerCase().includes(q)
        || (this.tenantNames.get(t.tenantId) || '').toLowerCase().includes(q),
      );
    }
    if (this.filterMode === 'enabled') rows = rows.filter(t => t.enabled);
    if (this.filterMode === 'disabled') rows = rows.filter(t => !t.enabled);
    return rows;
  }

  /** Aggregated counts shown at the top of the page. */
  get totalEnabled(): number {
    return this.tenants.filter(t => t.enabled).length;
  }
  get totalUsedThisMonth(): number {
    return this.tenants.reduce((sum, t) => sum + (t.costUsedThisMonth || 0), 0);
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  // ── Expansion + template-dot helpers ───────────────────────────

  /** Predicate for the expanded-detail row template. The `mat-table` calls
   *  this for every data row — return true only for the currently expanded
   *  tenant so a single detail row renders. Keeps the column-set tidy and
   *  avoids relying on `*ngIf` inside row templates (Material doesn't
   *  support that). */
  readonly isExpansionRow = (_index: number, row: TenantSmsSettingsDto): boolean =>
    this.expandedTenantId === row.tenantId;

  /** Toggle expansion for a tenant row. Fires off a one-time templates
   *  fetch so the dot indicators next to the trigger checkboxes can light
   *  up. Cached forever — re-fetching on every expand would cause the
   *  dots to flicker. The panel inside the expanded row re-fetches on its
   *  own ngOnInit too; that's fine, both calls converge on the same data. */
  toggleExpand(tenant: TenantSmsSettingsDto): void {
    if (this.expandedTenantId === tenant.tenantId) {
      this.expandedTenantId = null;
      return;
    }
    this.expandedTenantId = tenant.tenantId;
    if (!this.templatesByTenant.has(tenant.tenantId)) {
      this.api.getTenantSmsTemplates(tenant.tenantId).subscribe({
        next: (res) => {
          this.templatesByTenant.set(tenant.tenantId, res?.data ?? {});
        },
        error: () => {
          // Cache an empty map so we don't refetch on every re-expand.
          // The panel itself will surface load errors via its own snackbar.
          this.templatesByTenant.set(tenant.tenantId, {});
        },
      });
    }
  }

  /** Whether a given trigger has a configured template for this tenant.
   *  Drives the green/grey dot next to the checkbox. Returns false until
   *  the tenant's row is first expanded (lazy fetch). */
  hasTemplate(tenantId: string, trigger: SmsTriggerKey): boolean {
    const cfg = this.templatesByTenant.get(tenantId);
    if (!cfg) return false;
    const t = cfg[trigger];
    return !!(t?.templateId && t?.senderId);
  }
}
