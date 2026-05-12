import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { Tenant } from '../../../core/models';

/**
 * Picker dialog used by the SMS Control panel to enable SMS for a
 * tenant that doesn't yet have a settings document.
 *
 * Workflow:
 *   1. Super admin clicks "+ Enable for tenant"
 *   2. Dialog fetches /api/v1/super/tenants and shows them in a dropdown,
 *      filtered to exclude tenants that already have an SMS row
 *   3. Super admin picks one (or types the tenantId directly as a
 *      fallback for very large tenant lists)
 *   4. Confirm → dialog closes with the chosen tenantId
 *   5. Parent (SmsControlComponent) PATCHes the backend with
 *      enabled=true + default trigger/budget
 */
@Component({
  selector: 'app-enable-tenant-sms-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title class="t-title">
      <mat-icon class="t-icon">sms</mat-icon>
      Enable SMS for a tenant
    </h2>

    <mat-dialog-content>
      <p class="t-sub">
        Pick a school to enable SMS notifications for. A settings row will
        be created with absence alerts ON and a ₹2,000 monthly budget —
        you can fine-tune in the table afterwards.
      </p>

      <div class="t-loading" *ngIf="isLoading">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Loading tenants…</span>
      </div>

      <ng-container *ngIf="!isLoading">
        <mat-form-field appearance="outline" class="t-field" *ngIf="availableTenants.length > 0">
          <mat-label>School</mat-label>
          <mat-select [(value)]="selectedTenantId">
            <mat-option *ngFor="let t of availableTenants" [value]="t.tenantId">
              {{ t.schoolName }}  ·  <code>{{ t.tenantId }}</code>
            </mat-option>
          </mat-select>
        </mat-form-field>

        <div class="t-empty" *ngIf="availableTenants.length === 0">
          <mat-icon>info</mat-icon>
          <span>
            All existing tenants already have SMS settings. Use the table
            to toggle them. To onboard a new school, create it in the
            Tenants page first.
          </span>
        </div>

        <mat-form-field appearance="outline" class="t-field t-manual">
          <mat-label>Or type a tenant ID directly</mat-label>
          <mat-icon matPrefix>edit</mat-icon>
          <input matInput [(ngModel)]="manualTenantId" placeholder="e.g. springfield"/>
          <mat-hint>Use this when the dropdown is empty or you want to bypass the list</mat-hint>
        </mat-form-field>
      </ng-container>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary"
              [disabled]="!effectiveTenantId() || isLoading"
              (click)="confirm()">
        <mat-icon>check</mat-icon>
        Enable
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .t-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .t-icon { color: #D4A843; }
    .t-sub {
      margin: 0 0 18px;
      color: #6b7280;
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .t-loading {
      display: flex; gap: 12px; align-items: center;
      padding: 16px 0;
      color: #6b7280;
    }
    .t-field { width: 100%; }
    .t-manual { margin-top: 8px; }
    .t-empty {
      display: flex; gap: 10px;
      padding: 14px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 8px;
      color: #92400e;
      font-size: 0.88rem;
      line-height: 1.45;
      mat-icon { flex-shrink: 0; color: #f59e0b; }
    }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85em;
      color: #6b7280;
    }
  `],
})
export class EnableTenantSmsDialogComponent implements OnInit {
  /** All tenants in the platform. */
  allTenants: Tenant[] = [];
  /** Filtered subset — those without an SMS settings row yet. */
  availableTenants: Tenant[] = [];
  selectedTenantId = '';
  manualTenantId = '';
  isLoading = false;

  constructor(
    private api: ApiService,
    public dialogRef: MatDialogRef<EnableTenantSmsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { existingTenantIds: Set<string> },
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  private loadTenants(): void {
    this.isLoading = true;
    // Fetch first 100 tenants. Pagination via this dialog isn't worth
    // the complexity — anyone with 100+ tenants will use the manual
    // tenant-id input below the dropdown.
    this.api.getTenants(0, 100).subscribe({
      next: (res) => {
        const list = (res?.data as { content?: Tenant[] } | undefined)?.content ?? [];
        this.allTenants = list;
        this.availableTenants = list.filter(t => !this.data.existingTenantIds.has(t.tenantId));
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  /** Manual input wins over dropdown selection — lets the super admin
   *  bypass the picker entirely if needed. */
  effectiveTenantId(): string {
    return this.manualTenantId.trim() || this.selectedTenantId;
  }

  confirm(): void {
    const id = this.effectiveTenantId();
    if (!id) return;
    this.dialogRef.close(id);
  }
}
