import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../../core/services/api.service';
import { LeaveType } from '../../../../core/models';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

/**
 * HR-only page for managing the tenant's leave-type catalog. Fresh
 * tenants come with CL / SL / EL / LOP seeded by
 * {@code LeaveTypeService.seedDefaultsIfEmpty}; this page lets HR
 * add school-specific types (e.g., MATERNITY) or tweak the default
 * annual quotas.
 *
 * <p>Deactivating a type hides it from the employee Apply Leave
 * dropdown but keeps historical applications + balances intact —
 * codes are the stable key downstream.</p>
 */
@Component({
  selector: 'app-hr-leave-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatSlideToggleModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-leave-settings.component.html',
  styleUrl: './hr-leave-settings.component.scss',
})
export class HrLeaveSettingsComponent implements OnInit {

  types: LeaveType[] = [];
  isLoading = false;
  togglingId: string | null = null;

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading = true;
    this.api.hrLeaveTypes().subscribe({
      next: (res) => { this.types = res.data || []; this.isLoading = false; },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load leave types.', 'Close', { duration: 4000 });
      },
    });
  }

  /** Route to the dedicated create page. Router return brings us back
   *  here and re-runs ngOnInit → load, so no manual reload wiring
   *  needed on the caller side. */
  openCreate(): void {
    this.router.navigate(['/hr/leave/settings/type/new']);
  }

  openEdit(t: LeaveType): void {
    this.router.navigate(['/hr/leave/settings/type', t.id, 'edit']);
  }

  toggle(t: LeaveType): void {
    if (this.togglingId) return;
    this.togglingId = t.id;
    this.api.hrToggleLeaveType(t.id).subscribe({
      next: () => {
        this.togglingId = null;
        this.load();
      },
      error: (err) => {
        this.togglingId = null;
        this.snack.open(err?.error?.message || 'Failed to toggle.', 'Close', { duration: 4000 });
      },
    });
  }

  /** Take the type's hex color and produce a faded tint suitable
   *  for the code badge background. Falls back to a gold-tinted
   *  default if no color is set. Naive rgba(hex, 0.15) works for
   *  the 6-char hex codes the swatch picker produces. */
  fadeColor(hex?: string): string {
    if (!hex || hex.length !== 7 || !hex.startsWith('#')) return '#fff7db';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  }
}
