import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../../core/services/api.service';
import { LeaveType } from '../../../../core/models';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { LeaveTypeDialogComponent } from './leave-type-dialog/leave-type-dialog.component';

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
    MatDialogModule, MatTooltipModule,
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
    private dialog: MatDialog,
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

  openCreate(): void {
    const ref = this.dialog.open(LeaveTypeDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: ['centered-dialog'],
      data: { mode: 'create' },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  openEdit(t: LeaveType): void {
    const ref = this.dialog.open(LeaveTypeDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: ['centered-dialog'],
      data: { mode: 'edit', type: t },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
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
}
