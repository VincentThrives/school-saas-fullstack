import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ApiService } from '../../core/services/api.service';
import { AcademicYear, SchoolClass } from '../../core/models';
import { ExamTypeCatalogComponent } from './exam-type-catalog/exam-type-catalog.component';

type SlotKind = 'FA' | 'SA' | 'OTHER';

interface SlotLite {
  key?: string;
  label: string;
  kind: SlotKind;
  rawMax: number;
  weightMax: number;
  // Pulled-forward contribution (added on top of the paper's weighted) and
  // whether the slot's marks reach the grand total. Preserved from the API
  // so the list card shows the right chips and total.
  pulledContributionMax: number;
  includeInGrandTotal: boolean;
}

interface Row {
  id?: string;
  name: string;
  displayOrder: number;
  defaultMaxMarks?: number | null;
  description?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  applicableClassIds?: string[];
  slots?: SlotLite[] | null;
  academicYearId?: string | null;
  createdAt?: string;
}

@Component({
  selector: 'app-exam-types-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatTooltipModule, MatChipsModule, MatTabsModule, MatSnackBarModule,
    PageHeaderComponent,
    ExamTypeCatalogComponent,
  ],
  templateUrl: './exam-types-page.component.html',
  styleUrl: './exam-types-page.component.scss',
})
export class ExamTypesPageComponent implements OnInit {
  types: Row[] = [];
  isLoading = false;
  showArchived = false;

  // Delete confirmation
  deleteDialogOpen = false;
  rowToDelete: Row | null = null;
  isDeleting = false;

  // Class catalog for chip labels
  classes: SchoolClass[] = [];

  // Academic-year filter — defaults to current, "" means "all years".
  academicYears: AcademicYear[] = [];
  selectedYearId = '';

  readonly slotKinds: { value: SlotKind; label: string; color: string }[] = [
    { value: 'FA', label: 'Formative (FA)', color: '#0369a1' },
    { value: 'SA', label: 'Summative (SA)', color: '#7c3aed' },
    { value: 'OTHER', label: 'Other', color: '#6b7280' },
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadClasses();
  }

  load(): void {
    this.isLoading = true;
    this.api.getExamSchemes(this.showArchived, this.selectedYearId || undefined).subscribe({
      next: (res: any) => {
        this.types = (res?.data || []).map((r: any) => this.normalizeIncoming(r));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam types', 'Close', { duration: 3000 });
      },
    });
  }

  private loadClasses(): void {
    this.api.getAcademicYears().subscribe({
      next: (res: any) => {
        const years: AcademicYear[] = Array.isArray(res?.data) ? res.data : [];
        this.academicYears = years;
        const current = years.find(y => (y as any).current) || years[0];
        if (current?.academicYearId) {
          // Default the filter to the current year on first load.
          if (!this.selectedYearId) {
            this.selectedYearId = current.academicYearId;
            this.load();
          }
          this.api.getClasses(current.academicYearId).subscribe({
            next: (r: any) => this.classes = Array.isArray(r?.data) ? r.data : [],
          });
        }
      },
    });
  }

  onToggleArchived(): void { this.load(); }
  onYearFilterChange(): void { this.load(); }

  yearLabel(id?: string | null): string {
    if (!id) return 'Any year';
    const y = this.academicYears.find(y => y.academicYearId === id);
    return y ? y.label : id;
  }

  private normalizeIncoming(r: any): Row {
    return {
      id: r.id,
      name: r.name,
      displayOrder: r.displayOrder,
      defaultMaxMarks: r.defaultMaxMarks ?? null,
      description: r.description,
      status: r.status,
      applicableClassIds: Array.isArray(r.applicableClassIds) ? r.applicableClassIds : [],
      academicYearId: r.academicYearId || null,
      slots: Array.isArray(r.slots) ? r.slots.map((s: any) => ({
        key: s.key,
        label: s.label,
        kind: (s.kind as SlotKind) || 'FA',
        rawMax: Number(s.rawMax) || 0,
        weightMax: Number(s.weightMax) || 0,
        pulledContributionMax: s.pullForward
          ? (Number(s.pullForward.contributionMax) || 0)
          : 0,
        includeInGrandTotal: s.includeInGrandTotal == null ? true : !!s.includeInGrandTotal,
      })) : null,
    };
  }

  /**
   * Grand total = sum of (weighted + pulled) for slots the admin flagged as
   * counted. Mirrors the editor's own grandWeight so the list card and the
   * editor's totals strip always agree.
   */
  rowWeightTotal(row: Row): number {
    return (row.slots || [])
      .filter(s => s.includeInGrandTotal !== false)
      .reduce((sum, s) => sum + (Number(s.weightMax) || 0) + (Number(s.pulledContributionMax) || 0), 0);
  }

  classChipLabels(row: Row): string[] {
    if (!row.applicableClassIds?.length) return ['All classes'];
    return row.applicableClassIds
      .map(id => this.classes.find(c => c.classId === id)?.name || id)
      .slice(0, 6);
  }

  kindMeta(k: SlotKind): { label: string; color: string } {
    return this.slotKinds.find(x => x.value === k) || this.slotKinds[0];
  }

  openCreate(): void {
    this.router.navigate(['/exam-types', 'new']);
  }

  openEdit(row: Row): void {
    if (!row.id) return;
    this.router.navigate(['/exam-types', row.id, 'edit']);
  }

  openRollout(row: Row): void {
    if (!row.id) return;
    this.router.navigate(['/exam-types', row.id, 'rollout']);
  }

  archive(row: Row): void {
    if (!row.id) return;
    this.api.archiveExamScheme(row.id).subscribe({
      next: () => { this.snackBar.open('Archived', 'Close', { duration: 2500 }); this.load(); },
      error: () => this.snackBar.open('Failed to archive', 'Close', { duration: 3000 }),
    });
  }

  restore(row: Row): void {
    if (!row.id) return;
    this.api.restoreExamScheme(row.id).subscribe({
      next: () => { this.snackBar.open('Restored', 'Close', { duration: 2500 }); this.load(); },
      error: () => this.snackBar.open('Failed to restore', 'Close', { duration: 3000 }),
    });
  }

  remove(row: Row): void {
    if (!row?.id) return;
    this.rowToDelete = row;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    if (this.isDeleting) return;
    this.deleteDialogOpen = false;
    this.rowToDelete = null;
  }

  confirmDelete(): void {
    const row = this.rowToDelete;
    if (!row?.id) return;
    this.isDeleting = true;
    this.api.deleteExamScheme(row.id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.deleteDialogOpen = false;
        this.rowToDelete = null;
        this.snackBar.open(`Deleted "${row.name}"`, 'Close', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.isDeleting = false;
        this.snackBar.open(err?.error?.message || 'Failed to delete', 'Close', { duration: 5000 });
      },
    });
  }
}
