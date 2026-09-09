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
import { LeaveType, UpsertLeaveTypeRequest } from '../../../../../core/models';

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
  }

  pickColor(c: string): void { this.form.color = c; }

  submit(): void {
    if (this.isSaving) return;
    if (!this.form.code?.trim()) return this.snackErr('Code is required.');
    if (!this.form.name?.trim()) return this.snackErr('Name is required.');

    const code = this.form.code.trim().toUpperCase();
    if (!this.isEdit && (code.length < 2 || code.length > 8)) {
      return this.snackErr('Code must be 2–8 characters.');
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
}
