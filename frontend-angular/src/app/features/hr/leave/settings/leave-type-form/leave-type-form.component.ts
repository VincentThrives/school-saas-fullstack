import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../../../core/services/api.service';
import {
  LeaveType, UpsertLeaveTypeRequest, CategoryPolicy, EmploymentCategory,
  EMPLOYMENT_CATEGORY_OPTIONS,
} from '../../../../../core/models';

/**
 * Full-page Leave Type editor — same 4-tab form the dialog held,
 * but with room to breathe. Routing shape:
 * <ul>
 *   <li>{@code /hr/leave/settings/type/new} — create mode.</li>
 *   <li>{@code /hr/leave/settings/type/:id/edit} — edit mode; loads
 *       the existing type via id.</li>
 * </ul>
 * Both routes fall back to the Settings list on cancel / save
 * success so the sticky-note UX ("do a thing, land back where you
 * started") stays intact.
 */
@Component({
  selector: 'app-leave-type-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatSelectModule, MatSlideToggleModule, MatProgressSpinnerModule,
    MatTabsModule, MatTooltipModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './leave-type-form.component.html',
  styleUrl: './leave-type-form.component.scss',
})
export class LeaveTypeFormComponent implements OnInit {

  isEdit = false;
  isLoading = false;
  isSaving = false;

  /** Populated on edit-mode load — keeps the code untouched (immutable). */
  editingId: string | null = null;

  form: {
    code: string;
    name: string;
    description: string;
    color: string;
    defaultAnnualQuota: number;
    paid: boolean;
    sortOrder: number;
    carryForward: boolean;
    carryForwardMax: number;
    accrualType: 'YEARLY' | 'MONTHLY' | 'QUARTERLY';
    minAdvanceDays: number;
    maxConsecutiveDays: number;
    requiresAttachmentAfterDays: number;
    applicableGender: 'ANY' | 'MALE' | 'FEMALE';
    mandatoryPerYear: number;
  } = {
    code: '',
    name: '',
    description: '',
    color: '#3b82f6',
    defaultAnnualQuota: 0,
    paid: true,
    sortOrder: 500,
    carryForward: false,
    carryForwardMax: 0,
    accrualType: 'YEARLY',
    minAdvanceDays: 0,
    maxConsecutiveDays: 0,
    requiresAttachmentAfterDays: 0,
    applicableGender: 'ANY',
    mandatoryPerYear: 0,
  };

  /** Curated palette shown as swatches — brand-safe colors HR picks
   *  from rather than typing arbitrary hex. */
  readonly colorSwatches = [
    '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#a855f7', '#ec4899', '#64748b',
  ];

  /** Employment categories the per-category tabs render. Same list
   *  the Teacher form dropdown uses so the two stay in lockstep. */
  readonly categoryOptions = EMPLOYMENT_CATEGORY_OPTIONS;

  /** Toggle: "Different rules per employee type". OFF (default) → the
   *  single set of top-level fields on {@link #form} applies to
   *  everyone (backwards-compatible). ON → {@link #perCategory} carries
   *  one entry per category, each with the same field set. */
  perCategoryEnabled = false;

  /** Per-category form state. Populated from the type's `policies`
   *  list on load; falls back to a copy of the top-level fields for
   *  every category on first "ON" flip so HR starts from something
   *  sensible rather than zeroes. */
  perCategory: Record<EmploymentCategory, CategoryPolicy> = this.emptyPerCategory();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private api: ApiService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit = !!id;
    if (id) {
      this.editingId = id;
      this.loadForEdit(id);
    }
  }

  /** Edit-mode load — we don't have a dedicated get-by-id endpoint,
   *  so pull the full list and match by id. Fast enough at the
   *  scale a school's leave-type catalog lives at. */
  private loadForEdit(id: string): void {
    this.isLoading = true;
    this.api.hrLeaveTypes().subscribe({
      next: (res) => {
        const t = (res.data || []).find(x => x.id === id);
        if (!t) {
          this.isLoading = false;
          this.snack.open('Leave type not found — it may have been deleted.',
            'Close', { duration: 4000 });
          this.router.navigate(['/hr/leave/settings']);
          return;
        }
        this.hydrateFromEntity(t);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load leave type.', 'Close', { duration: 4000 });
      },
    });
  }

  private hydrateFromEntity(t: LeaveType): void {
    this.form.code = t.code;
    this.form.name = t.name;
    this.form.description = t.description || '';
    this.form.color = t.color || '#3b82f6';
    this.form.defaultAnnualQuota = t.defaultAnnualQuota;
    this.form.paid = t.paid;
    this.form.sortOrder = t.sortOrder;
    this.form.carryForward = t.carryForward;
    this.form.carryForwardMax = t.carryForwardMax;
    this.form.accrualType = t.accrualType;
    this.form.minAdvanceDays = t.minAdvanceDays;
    this.form.maxConsecutiveDays = t.maxConsecutiveDays;
    this.form.requiresAttachmentAfterDays = t.requiresAttachmentAfterDays;
    this.form.applicableGender = t.applicableGender;
    this.form.mandatoryPerYear = t.mandatoryPerYear;

    // Per-category — legacy types come back with null / empty; we
    // leave the toggle OFF and pre-fill the per-category map with the
    // top-level values so a first-time flip ON doesn't drop HR onto
    // a screen of zeroes.
    const loadedPolicies = t.policies || [];
    if (loadedPolicies.length > 0) {
      this.perCategoryEnabled = true;
      this.perCategory = this.emptyPerCategory();
      for (const p of loadedPolicies) {
        const code = p.categoryCode as EmploymentCategory | null;
        if (code && this.perCategory[code]) {
          this.perCategory[code] = { ...this.perCategory[code], ...p, categoryCode: code };
        }
      }
      // Any categories the loaded list didn't cover keep the seeded
      // defaults from emptyPerCategory (i.e. the type's top-level
      // fields) so HR can enable them later without a jarring reset.
    } else {
      this.perCategoryEnabled = false;
      this.perCategory = this.seedPerCategoryFromTopLevel();
    }
  }

  pickColor(c: string): void { this.form.color = c; }

  /** Called when HR flips the "Different rules per employee type"
   *  toggle. On first ON, seed every category from the top-level
   *  fields so HR isn't starting from zeroes. */
  onPerCategoryToggle(): void {
    if (this.perCategoryEnabled) {
      this.perCategory = this.seedPerCategoryFromTopLevel();
    }
  }

  /** Empty policy map — every category defaulted to zeros. */
  private emptyPerCategory(): Record<EmploymentCategory, CategoryPolicy> {
    const empty = (code: EmploymentCategory): CategoryPolicy => ({
      categoryCode: code,
      annualQuota: 0,
      accrualType: 'YEARLY',
      carryForward: false,
      carryForwardMax: 0,
      minAdvanceDays: 0,
      maxConsecutiveDays: 0,
      mandatoryPerYear: 0,
    });
    return {
      FULL_TIME: empty('FULL_TIME'),
      CONTRACT:  empty('CONTRACT'),
      PROBATION: empty('PROBATION'),
      PART_TIME: empty('PART_TIME'),
    };
  }

  /** Copy of top-level form values applied to every category — used
   *  as the sensible starting point when HR first enables per-category
   *  rules. From there HR tweaks the numbers that differ. */
  private seedPerCategoryFromTopLevel(): Record<EmploymentCategory, CategoryPolicy> {
    const seed = (code: EmploymentCategory): CategoryPolicy => ({
      categoryCode: code,
      annualQuota: this.form.defaultAnnualQuota,
      accrualType: this.form.accrualType,
      carryForward: this.form.carryForward,
      carryForwardMax: this.form.carryForwardMax,
      minAdvanceDays: this.form.minAdvanceDays,
      maxConsecutiveDays: this.form.maxConsecutiveDays,
      mandatoryPerYear: this.form.mandatoryPerYear,
    });
    return {
      FULL_TIME: seed('FULL_TIME'),
      CONTRACT:  seed('CONTRACT'),
      PROBATION: seed('PROBATION'),
      PART_TIME: seed('PART_TIME'),
    };
  }

  // ── Cross-field validation ────────────────────────────────────
  // Cross-field rules that a single-field @min / required can't
  // express — checked live for inline warnings AND right before
  // submit as a safety net.

  /** Return a human-readable message if the (annualQuota, cap) pair
   *  violates "cap ≤ annual" — else empty string. */
  carryFwdError(annual: number, cap: number, carryOn: boolean): string {
    if (!carryOn) return '';
    if (Number(cap) > Number(annual) && Number(annual) > 0) {
      return `Carry-forward cap (${cap}) can't exceed the annual quota (${annual}).`;
    }
    return '';
  }

  /** Compulsory quota can't exceed the annual quota — you can't be
   *  required to take more days than you get. */
  mandatoryError(annual: number, mandatory: number): string {
    if (Number(mandatory) > Number(annual) && Number(annual) > 0) {
      return `Compulsory quota (${mandatory}) can't exceed the annual quota (${annual}).`;
    }
    return '';
  }

  /** Max-consecutive can't exceed the annual quota (when quota is
   *  capped) — you can't take a longer stretch than your yearly
   *  allotment. Uncapped types (annual=0) skip this check. */
  maxConsecError(annual: number, maxConsec: number): string {
    if (Number(maxConsec) > Number(annual) && Number(annual) > 0) {
      return `Max consecutive days (${maxConsec}) can't exceed the annual quota (${annual}).`;
    }
    return '';
  }

  /** Top-level (per-category OFF) validation errors — collected into a
   *  list the template's warning banner iterates. Empty list = valid. */
  get topLevelErrors(): string[] {
    if (this.perCategoryEnabled) return [];
    const errs: string[] = [];
    const e1 = this.carryFwdError(
      this.form.defaultAnnualQuota, this.form.carryForwardMax, this.form.carryForward);
    const e2 = this.mandatoryError(this.form.defaultAnnualQuota, this.form.mandatoryPerYear);
    const e3 = this.maxConsecError(this.form.defaultAnnualQuota, this.form.maxConsecutiveDays);
    if (e1) errs.push(e1);
    if (e2) errs.push(e2);
    if (e3) errs.push(e3);
    return errs;
  }

  /** Per-tab errors — used inline inside each category tab so HR sees
   *  which tab is wrong at a glance. */
  categoryErrors(code: EmploymentCategory): string[] {
    const p = this.perCategory[code];
    if (!p) return [];
    const errs: string[] = [];
    const e1 = this.carryFwdError(p.annualQuota, p.carryForwardMax, p.carryForward);
    const e2 = this.mandatoryError(p.annualQuota, p.mandatoryPerYear);
    const e3 = this.maxConsecError(p.annualQuota, p.maxConsecutiveDays);
    if (e1) errs.push(e1);
    if (e2) errs.push(e2);
    if (e3) errs.push(e3);
    return errs;
  }

  /** Aggregate of every error across the form — drives the Save
   *  button's disabled state and the sticky footer's tooltip. */
  get allErrors(): string[] {
    if (!this.perCategoryEnabled) return this.topLevelErrors;
    const out: string[] = [];
    for (const c of this.categoryOptions) {
      const errs = this.categoryErrors(c.value);
      for (const e of errs) out.push(`${c.label}: ${e}`);
    }
    return out;
  }

  get hasValidationErrors(): boolean { return this.allErrors.length > 0; }

  submit(): void {
    if (this.isSaving) return;
    if (!this.form.code?.trim()) return this.snackErr('Code is required.');
    if (!this.form.name?.trim()) return this.snackErr('Name is required.');

    const code = this.form.code.trim().toUpperCase();
    if (!this.isEdit && (code.length < 2 || code.length > 8)) {
      return this.snackErr('Code must be 2–8 characters.');
    }
    // Cross-field guard — surfaces the same messages the banner shows
    // so submitting through Enter still gets caught.
    if (this.hasValidationErrors) {
      return this.snackErr(this.allErrors[0]);
    }

    const payload: UpsertLeaveTypeRequest = {
      code: this.isEdit ? undefined : code,
      name: this.form.name.trim(),
      description: this.form.description.trim() || undefined,
      color: this.form.color,
      defaultAnnualQuota: Number(this.form.defaultAnnualQuota) || 0,
      paid: this.form.paid,
      sortOrder: Number(this.form.sortOrder) || 500,
      carryForward: this.form.carryForward,
      carryForwardMax: Number(this.form.carryForwardMax) || 0,
      accrualType: this.form.accrualType,
      minAdvanceDays: Number(this.form.minAdvanceDays) || 0,
      maxConsecutiveDays: Number(this.form.maxConsecutiveDays) || 0,
      requiresAttachmentAfterDays: Number(this.form.requiresAttachmentAfterDays) || 0,
      applicableGender: this.form.applicableGender,
      mandatoryPerYear: Number(this.form.mandatoryPerYear) || 0,
      // policies:
      //  - toggle OFF → send []; server clears any prior overrides
      //    so the top-level fields apply to everyone (matches the
      //    "same rules for everyone" mental model exactly).
      //  - toggle ON  → send one entry per category with the tab's
      //    field values, normalising numeric strings to numbers.
      policies: this.perCategoryEnabled
        ? this.categoryOptions.map(c => this.normalisePolicy(this.perCategory[c.value]))
        : [],
    };

    this.isSaving = true;
    const call$ = this.isEdit && this.editingId
      ? this.api.hrUpdateLeaveType(this.editingId, payload)
      : this.api.hrCreateLeaveType(payload);
    call$.subscribe({
      next: () => {
        this.isSaving = false;
        this.snack.open(this.isEdit ? 'Leave type updated.' : 'Leave type created.',
          'Close', { duration: 3000 });
        this.router.navigate(['/hr/leave/settings']);
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(err?.error?.message || 'Save failed.',
          'Close', { duration: 4500 });
      },
    });
  }

  /** Prefer history.back so users who deep-linked (e.g., from a
   *  browser bookmark) still land somewhere sane — fallback is the
   *  settings list. */
  cancel(): void {
    if (window.history.length > 1) this.location.back();
    else this.router.navigate(['/hr/leave/settings']);
  }

  private snackErr(msg: string): void {
    this.snack.open(msg, 'Close', { duration: 3500 });
  }

  /** Ensure numeric fields go over the wire as numbers, not
   *  form-input string values. Backend deserializes doubles/ints
   *  strictly. */
  private normalisePolicy(p: CategoryPolicy): CategoryPolicy {
    return {
      categoryCode: p.categoryCode,
      annualQuota: Number(p.annualQuota) || 0,
      accrualType: p.accrualType,
      carryForward: !!p.carryForward,
      carryForwardMax: Number(p.carryForwardMax) || 0,
      minAdvanceDays: Number(p.minAdvanceDays) || 0,
      maxConsecutiveDays: Number(p.maxConsecutiveDays) || 0,
      mandatoryPerYear: Number(p.mandatoryPerYear) || 0,
    };
  }
}
