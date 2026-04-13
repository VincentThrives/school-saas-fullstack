import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Tenant } from '../../../core/models';

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './tenant-detail.component.html',
  styleUrl: './tenant-detail.component.scss',
})
export class TenantDetailComponent implements OnInit {
  tenant: Tenant | null = null;
  isLoading = true;
  tenantId = '';

  deleteDialogOpen = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    if (this.tenantId) {
      this.loadTenant();
    }
  }

  loadTenant(): void {
    this.isLoading = true;
    this.apiService.getTenantById(this.tenantId).subscribe({
      next: (response) => {
        this.tenant = response.data;
        this.isLoading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load school details', 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  get featureEntries(): { key: string; enabled: boolean }[] {
    if (!this.tenant?.featureFlags) return [];
    return Object.entries(this.tenant.featureFlags).map(([key, enabled]) => ({ key, enabled }));
  }

  get enabledFeatureCount(): number {
    if (!this.tenant?.featureFlags) return 0;
    return Object.values(this.tenant.featureFlags).filter(v => v).length;
  }

  get totalFeatureCount(): number {
    if (!this.tenant?.featureFlags) return 0;
    return Object.keys(this.tenant.featureFlags).length;
  }

  navigateToFeatures(): void {
    this.router.navigate(['/superadmin/features', this.tenantId]);
  }

  changeTenantStatus(): void {
    if (!this.tenant) return;
    const newStatus = this.tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.apiService.changeTenantStatus(this.tenantId, newStatus).subscribe({
      next: () => {
        this.snackBar.open(`School ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'} successfully`, 'Close', { duration: 3000 });
        this.loadTenant();
      },
      error: () => {
        this.snackBar.open('Failed to change school status', 'Close', { duration: 3000 });
      },
    });
  }

  confirmDelete(): void {
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
  }

  deleteTenant(): void {
    this.deleteDialogOpen = false;
    this.apiService.deleteTenant(this.tenantId).subscribe({
      next: () => {
        this.snackBar.open('School deleted successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/superadmin/tenants']);
      },
      error: () => {
        this.snackBar.open('Failed to delete school', 'Close', { duration: 3000 });
      },
    });
  }

  getPlanClass(plan: string): string {
    switch (plan?.toUpperCase()) {
      case 'BASIC': return 'plan-basic';
      case 'STANDARD': return 'plan-standard';
      case 'ENTERPRISE': return 'plan-enterprise';
      default: return 'plan-basic';
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'status-active';
      case 'INACTIVE': return 'status-inactive';
      case 'SUSPENDED': return 'status-suspended';
      default: return 'status-inactive';
    }
  }

  formatFeatureKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getFullAddress(): string {
    if (!this.tenant?.address) return 'No address provided';
    const a = this.tenant.address;
    const parts = [a.street, a.city, a.state, a.country, a.zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address provided';
  }
}
