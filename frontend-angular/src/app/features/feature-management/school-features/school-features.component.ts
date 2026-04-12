import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import {
  SchoolFeatureResponse,
  FeatureDetail,
  FeatureTemplate,
  FeatureToggleRequest,
  BulkFeatureToggleRequest,
} from '../../../core/models';
import { ConfirmDisableDialogComponent } from './confirm-disable-dialog.component';

@Component({
  selector: 'app-school-features',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    PageHeaderComponent,
  ],
  templateUrl: './school-features.component.html',
  styleUrl: './school-features.component.scss',
})
export class SchoolFeaturesComponent implements OnInit, OnDestroy {
  tenantId = '';
  schoolData: SchoolFeatureResponse | null = null;
  templates: FeatureTemplate[] = [];
  categories: string[] = [];
  isLoading = false;
  isSaving = false;

  breadcrumbs: Breadcrumb[] = [];

  private destroy$ = new Subject<void>();

  readonly categoryIcons: Record<string, string> = {
    'Academics': 'school',
    'Exams': 'assignment',
    'Finance': 'payment',
    'Communication': 'chat',
    'Administration': 'admin_panel_settings',
    'Analytics': 'bar_chart',
    'Content': 'menu_book',
    'Events': 'event',
  };

  readonly planColors: Record<string, string> = {
    'BASIC': '#78909C',
    'STANDARD': '#D4A843',
    'ENTERPRISE': '#7B1FA2',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.tenantId = params['tenantId'] || '';
      if (this.tenantId) {
        this.loadData();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.isLoading = true;
    forkJoin({
      features: this.api.getSchoolFeatures(this.tenantId),
      templates: this.api.getFeatureTemplates(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.features.success && res.features.data) {
            this.schoolData = res.features.data;
            this.categories = Object.keys(this.schoolData.categories || {});
            this.breadcrumbs = [
              { label: 'Super Admin', link: '/superadmin/dashboard' },
              { label: 'Schools', link: '/superadmin/tenants' },
              { label: this.schoolData.schoolName },
              { label: 'Features' },
            ];
          }
          if (res.templates.success && res.templates.data) {
            this.templates = res.templates.data;
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open('Failed to load feature data', 'Close', { duration: 3000 });
        },
      });
  }

  getCategoryIcon(category: string): string {
    return this.categoryIcons[category] || 'extension';
  }

  getFeaturesForCategory(category: string): FeatureDetail[] {
    return this.schoolData?.categories?.[category] || [];
  }

  getEnabledInCategory(category: string): number {
    return this.getFeaturesForCategory(category).filter((f) => f.enabled).length;
  }

  getPlanColor(plan: string): string {
    return this.planColors[plan?.toUpperCase()] || '#78909C';
  }

  getEnabledCount(): number {
    return this.schoolData?.enabledFeatures || 0;
  }

  getTotalCount(): number {
    return this.schoolData?.totalFeatures || 0;
  }

  toggleFeature(feature: FeatureDetail): void {
    if (feature.coreFeature) return;

    const newState = !feature.enabled;

    if (!newState) {
      const dialogRef = this.dialog.open(ConfirmDisableDialogComponent, {
        width: '440px',
        data: { featureName: feature.displayName },
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result?.confirmed) {
          this.doToggle(feature, newState, result.reason);
        }
      });
    } else {
      this.doToggle(feature, newState);
    }
  }

  private doToggle(feature: FeatureDetail, enabled: boolean, reason?: string): void {
    this.isSaving = true;
    const req: FeatureToggleRequest = {
      featureKey: feature.featureKey,
      enabled,
      reason,
    };
    this.api.toggleFeature(this.tenantId, req).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        feature.enabled = enabled;
        if (this.schoolData) {
          this.schoolData.enabledFeatures += enabled ? 1 : -1;
        }
        this.isSaving = false;
        this.snackBar.open(
          `${feature.displayName} ${enabled ? 'enabled' : 'disabled'}`,
          'Close',
          { duration: 2000 },
        );
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Failed to toggle feature', 'Close', { duration: 3000 });
      },
    });
  }

  enableAll(): void {
    this.bulkToggle(true);
  }

  disableAll(): void {
    this.bulkToggle(false);
  }

  enableAllInCategory(category: string): void {
    const features = this.getFeaturesForCategory(category);
    const featureMap: Record<string, boolean> = {};
    features.forEach((f) => {
      if (!f.coreFeature) {
        featureMap[f.featureKey] = true;
      }
    });
    this.doBulkToggle(featureMap);
  }

  private bulkToggle(enabled: boolean): void {
    if (!this.schoolData) return;
    const featureMap: Record<string, boolean> = {};
    this.schoolData.features.forEach((f) => {
      if (!f.coreFeature) {
        featureMap[f.featureKey] = enabled;
      }
    });
    this.doBulkToggle(featureMap);
  }

  private doBulkToggle(features: Record<string, boolean>): void {
    this.isSaving = true;
    const req: BulkFeatureToggleRequest = { features };
    this.api.bulkToggleFeatures(this.tenantId, req).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving = false;
        this.loadData();
        this.snackBar.open('Features updated', 'Close', { duration: 2000 });
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Failed to update features', 'Close', { duration: 3000 });
      },
    });
  }

  applyTemplate(template: FeatureTemplate): void {
    this.isSaving = true;
    this.api.applyFeatureTemplate(this.tenantId, template.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving = false;
        this.loadData();
        this.snackBar.open(`Template "${template.name}" applied`, 'Close', { duration: 2000 });
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Failed to apply template', 'Close', { duration: 3000 });
      },
    });
  }

  viewAuditLog(): void {
    this.router.navigate(['/superadmin/features', this.tenantId, 'audit']);
  }
}
