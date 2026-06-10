import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService, ExamConfigSummary } from '../../../core/services/api.service';
import { AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-exam-config-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './exam-config-list.component.html',
  styleUrl: './exam-config-list.component.scss',
})
export class ExamConfigListComponent implements OnInit {
  configs: ExamConfigSummary[] = [];
  academicYearLabels: Record<string, string> = {};
  isLoading = false;

  /** Dialog state for the Edit/Delete warning popup. */
  pendingAction: 'edit' | 'delete' | null = null;
  pendingConfig: ExamConfigSummary | null = null;
  pendingHasMarks = false;
  isProcessing = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadAcademicYears();
    this.loadConfigs();
  }

  private loadAcademicYears(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        const years: AcademicYear[] = Array.isArray(data) ? data : (data as any)?.content || [];
        for (const y of years) {
          this.academicYearLabels[y.academicYearId] = y.label;
        }
      },
    });
  }

  loadConfigs(): void {
    this.isLoading = true;
    this.api.listExamConfigs().subscribe({
      next: (res) => {
        this.configs = (res?.data || [])
          // Show newest config first (by date desc, fallback to name).
          .sort((a, b) => (b.examDate || '').localeCompare(a.examDate || '')
                       || a.examType.localeCompare(b.examType));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam configs', 'Close', { duration: 3000 });
      },
    });
  }

  yearLabel(yearId: string): string {
    return this.academicYearLabels[yearId] || yearId;
  }

  createNew(): void {
    this.router.navigate(['/exams/config/new']);
  }

  // ── Edit ─────────────────────────────────────────────────────────────

  /**
   * Edit click → ask backend whether any exam in this config has marks
   * entered. If yes, the warning dialog opens and the admin confirms;
   * if no, we skip straight to the edit form.
   */
  startEdit(cfg: ExamConfigSummary): void {
    this.isProcessing = true;
    this.api.getExamConfigMarksStatus(cfg.academicYearId, cfg.examType).subscribe({
      next: (res) => {
        this.isProcessing = false;
        const hasMarks = !!res?.data?.anyMarksEntered;
        if (hasMarks) {
          // Open warning popup — admin must confirm before continuing.
          this.pendingAction = 'edit';
          this.pendingConfig = cfg;
          this.pendingHasMarks = true;
        } else {
          this.navigateToEdit(cfg);
        }
      },
      error: () => {
        this.isProcessing = false;
        // Probe failed — proceed but warn the user.
        this.snackBar.open(
          "Couldn't verify if marks exist — opening edit anyway.",
          'Close', { duration: 3000 });
        this.navigateToEdit(cfg);
      },
    });
  }

  private navigateToEdit(cfg: ExamConfigSummary): void {
    // Encode the type once — exam types are admin-typed strings and may
    // contain spaces, slashes, etc.
    const enc = encodeURIComponent(cfg.examType);
    this.router.navigate(['/exams/config', enc, 'edit'], {
      queryParams: { academicYearId: cfg.academicYearId },
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────

  startDelete(cfg: ExamConfigSummary): void {
    this.isProcessing = true;
    this.api.getExamConfigMarksStatus(cfg.academicYearId, cfg.examType).subscribe({
      next: (res) => {
        this.isProcessing = false;
        // Always show a confirm dialog — copy varies by marks-status.
        this.pendingAction = 'delete';
        this.pendingConfig = cfg;
        this.pendingHasMarks = !!res?.data?.anyMarksEntered;
      },
      error: () => {
        this.isProcessing = false;
        this.pendingAction = 'delete';
        this.pendingConfig = cfg;
        this.pendingHasMarks = cfg.examsWithMarks > 0;
      },
    });
  }

  cancelDialog(): void {
    this.pendingAction = null;
    this.pendingConfig = null;
    this.pendingHasMarks = false;
  }

  confirmDialog(): void {
    if (!this.pendingConfig || !this.pendingAction) return;
    if (this.pendingAction === 'edit') {
      const cfg = this.pendingConfig;
      this.cancelDialog();
      this.navigateToEdit(cfg);
      return;
    }
    // Delete path.
    this.isProcessing = true;
    const cfg = this.pendingConfig;
    this.api.deleteExamConfig(cfg.academicYearId, cfg.examType).subscribe({
      next: (res) => {
        this.isProcessing = false;
        const d = res?.data;
        const deletedExams = d?.deletedExams ?? 0;
        const deletedMarkDocs = d?.deletedMarkDocs ?? 0;
        let msg = `Deleted ${deletedExams} exam${deletedExams === 1 ? '' : 's'}`;
        if (deletedMarkDocs > 0) msg += ` and ${deletedMarkDocs} marks doc${deletedMarkDocs === 1 ? '' : 's'}`;
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cancelDialog();
        this.loadConfigs();
      },
      error: (err) => {
        this.isProcessing = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to delete config.',
          'Close', { duration: 4000 });
      },
    });
  }
}
