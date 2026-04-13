import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Tenant } from '../../../core/models';

@Component({
  selector: 'app-school-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    PageHeaderComponent,
  ],
  templateUrl: './school-selector.component.html',
  styleUrl: './school-selector.component.scss',
})
export class SchoolSelectorComponent implements OnInit {
  searchQuery = '';
  tenants: Tenant[] = [];
  filteredTenants: Tenant[] = [];
  isLoading = false;

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.isLoading = true;
    this.api.getTenants(0, 100).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.tenants = res.data.content || [];
          this.filteredTenants = [...this.tenants];
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  onSearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredTenants = [...this.tenants];
      return;
    }
    this.filteredTenants = this.tenants.filter(
      (t) =>
        t.schoolName?.toLowerCase().includes(q) ||
        t.subdomain?.toLowerCase().includes(q) ||
        t.tenantId?.toLowerCase().includes(q) ||
        t.contactEmail?.toLowerCase().includes(q)
    );
  }

  selectSchool(tenant: Tenant): void {
    this.router.navigate(['/superadmin/features', tenant.tenantId]);
  }

  getEnabledCount(tenant: Tenant): number {
    if (!tenant.featureFlags) return 0;
    return Object.values(tenant.featureFlags).filter((v) => v === true).length;
  }

  getTotalCount(tenant: Tenant): number {
    if (!tenant.featureFlags) return 0;
    return Object.keys(tenant.featureFlags).length;
  }

  getStatusColor(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'status-active';
      case 'SUSPENDED': return 'status-suspended';
      case 'INACTIVE': return 'status-inactive';
      default: return '';
    }
  }

  getPlanColor(plan: string): string {
    switch (plan?.toUpperCase()) {
      case 'ENTERPRISE': return 'plan-enterprise';
      case 'STANDARD': return 'plan-standard';
      default: return 'plan-basic';
    }
  }

  getInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || 'S';
  }
}
