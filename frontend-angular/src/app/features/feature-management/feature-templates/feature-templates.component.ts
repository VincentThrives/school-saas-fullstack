import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { FeatureTemplate, FeatureCatalogItem } from '../../../core/models';
import { CreateTemplateDialogComponent } from './create-template-dialog.component';

@Component({
  selector: 'app-feature-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
    DatePipe,
  ],
  templateUrl: './feature-templates.component.html',
  styleUrl: './feature-templates.component.scss',
})
export class FeatureTemplatesComponent implements OnInit, OnDestroy {
  templates: FeatureTemplate[] = [];
  catalog: FeatureCatalogItem[] = [];
  isLoading = false;

  breadcrumbs: Breadcrumb[] = [
    { label: 'Super Admin', link: '/superadmin/dashboard' },
    { label: 'Feature Templates' },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.isLoading = true;
    forkJoin({
      templates: this.api.getFeatureTemplates(),
      catalog: this.api.getFeatureCatalog(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.templates.success) {
            this.templates = res.templates.data || [];
          }
          if (res.catalog.success) {
            this.catalog = res.catalog.data || [];
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.snackBar.open('Failed to load templates', 'Close', { duration: 3000 });
        },
      });
  }

  getEnabledCount(template: FeatureTemplate): number {
    return Object.values(template.featureFlags || {}).filter(Boolean).length;
  }

  getTotalCount(template: FeatureTemplate): number {
    return Object.keys(template.featureFlags || {}).length;
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateTemplateDialogComponent, {
      width: '640px',
      maxHeight: '80vh',
      data: { catalog: this.catalog },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;
        this.api.createFeatureTemplate(result).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.snackBar.open('Template created', 'Close', { duration: 2000 });
            this.loadData();
          },
          error: () => {
            this.isLoading = false;
            this.snackBar.open('Failed to create template', 'Close', { duration: 3000 });
          },
        });
      }
    });
  }

  deleteTemplate(template: FeatureTemplate): void {
    if (!confirm(`Delete template "${template.name}"? This action cannot be undone.`)) return;

    this.api.deleteFeatureTemplate(template.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open('Template deleted', 'Close', { duration: 2000 });
        this.templates = this.templates.filter((t) => t.id !== template.id);
      },
      error: () => {
        this.snackBar.open('Failed to delete template', 'Close', { duration: 3000 });
      },
    });
  }

  applyToSchool(template: FeatureTemplate): void {
    this.router.navigate(['/superadmin/tenants']);
  }
}
