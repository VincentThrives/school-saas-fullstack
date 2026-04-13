import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Tenant } from '../../../core/models';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './tenants-list.component.html',
  styleUrl: './tenants-list.component.scss',
})
export class TenantsListComponent implements OnInit {
  displayedColumns: string[] = ['schoolName', 'contactEmail', 'plan', 'status', 'features', 'createdAt', 'actions'];
  dataSource = new MatTableDataSource<Tenant>([]);
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  isLoading = false;

  searchQuery = '';
  statusFilter = '';

  deleteDialogOpen = false;
  selectedTenant: Tenant | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.isLoading = true;
    const params: { status?: string; search?: string } = {};
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.searchQuery) params.search = this.searchQuery;

    this.apiService.getTenants(this.pageIndex, this.pageSize, params).subscribe({
      next: (response) => {
        this.dataSource.data = response.data.content;
        this.totalElements = response.data.totalElements;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load tenants', 'Close', { duration: 3000 });
      },
    });
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadTenants();
  }

  onStatusFilter(): void {
    this.pageIndex = 0;
    this.loadTenants();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTenants();
  }

  navigateToAddTenant(): void {
    this.router.navigate(['/superadmin/tenants/new']);
  }

  viewTenant(tenant: Tenant): void {
    this.router.navigate(['/superadmin/tenants', tenant.tenantId]);
  }

  manageFeatures(tenant: Tenant): void {
    this.router.navigate(['/superadmin/features', tenant.tenantId]);
  }

  changeTenantStatus(tenant: Tenant): void {
    const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.apiService.changeTenantStatus(tenant.tenantId, newStatus).subscribe({
      next: () => {
        this.snackBar.open(`School ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'} successfully`, 'Close', { duration: 3000 });
        this.loadTenants();
      },
      error: () => {
        this.snackBar.open('Failed to change school status', 'Close', { duration: 3000 });
      },
    });
  }

  confirmDelete(tenant: Tenant): void {
    this.selectedTenant = tenant;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedTenant = null;
  }

  deleteTenant(): void {
    if (!this.selectedTenant) return;
    const tenantId = this.selectedTenant.tenantId;
    this.deleteDialogOpen = false;
    this.selectedTenant = null;

    this.apiService.deleteTenant(tenantId).subscribe({
      next: () => {
        this.snackBar.open('School deleted successfully', 'Close', { duration: 3000 });
        this.loadTenants();
      },
      error: () => {
        this.snackBar.open('Failed to delete school', 'Close', { duration: 3000 });
      },
    });
  }

  getFeatureCount(tenant: Tenant): string {
    if (!tenant.featureFlags) return '0/0 enabled';
    const total = Object.keys(tenant.featureFlags).length;
    const enabled = Object.values(tenant.featureFlags).filter(v => v).length;
    return `${enabled}/${total} enabled`;
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

  getStatusAction(tenant: Tenant): string {
    return tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate';
  }

  getStatusActionIcon(tenant: Tenant): string {
    return tenant.status === 'ACTIVE' ? 'block' : 'check_circle';
  }

  getSchoolInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'S';
  }
}
