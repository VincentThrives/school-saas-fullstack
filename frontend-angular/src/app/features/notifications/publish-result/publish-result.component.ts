import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  ApiService,
  PublishResultPreview,
  PublishResultResult,
  PublishResultScope,
} from '../../../core/services/api.service';
import { SchoolClass } from '../../../core/models';
import { PublishResultConfirmDialogComponent } from './publish-result-confirm-dialog.component';

/**
 * Cascading-form to pick scope (exam type → class → section → subject)
 * and fan out personalised exam-result notifications to every student
 * plus their parents.
 *
 * Lives inside the Notifications page as a sibling tab. Visible to
 * SCHOOL_ADMIN and PRINCIPAL only — gated upstream in
 * notifications-page.component (the tab itself is hidden for other
 * roles), and the backend re-checks the role on every endpoint.
 */
@Component({
  selector: 'app-publish-result',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './publish-result.component.html',
  styleUrl: './publish-result.component.scss',
})
export class PublishResultComponent implements OnInit {

  // ── Catalog data ─────────────────────────────────────────
  classes: SchoolClass[] = [];
  /** All exams visible to this admin (we filter client-side as the
   *  scope is built so we don't need separate API calls per dropdown). */
  allExams: any[] = [];
  isLoadingClasses = false;
  isLoadingExams = false;

  // ── Form state ───────────────────────────────────────────
  examType = '';
  classId = '';
  sectionId = '';
  subjectId = ''; // empty string = "All Subjects"
  republish = false;

  // ── Derived dropdown options ─────────────────────────────
  // IMPORTANT: these MUST be plain fields, not getters returning fresh
  // arrays. With Material's mat-select overlay open, change detection
  // fires many times per second; a getter that returns a new array
  // every call makes *ngFor re-render every tick and the page locks up.
  // We recompute these only inside the cascade handlers below.
  sections: { sectionId: string; name: string }[] = [];
  examTypeOptions: string[] = [];
  subjectOptions: { subjectId: string; subjectName: string }[] = [];

  // ── Preview state ─────────────────────────────────────────
  preview: PublishResultPreview | null = null;
  isPreviewing = false;
  previewError = '';

  // ── Publish state ─────────────────────────────────────────
  isPublishing = false;

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadAllExams();
  }

  // ── Catalog loaders ──────────────────────────────────────

  private loadClasses(): void {
    this.isLoadingClasses = true;
    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = Array.isArray(res?.data) ? res.data : [];
        this.isLoadingClasses = false;
      },
      error: () => { this.isLoadingClasses = false; },
    });
  }

  /** Load every exam once. We filter against this list as the user picks
   *  examType/class/section/subject, which is cheap and avoids 4 chained
   *  API calls. If exam volume ever blows up (>5k), swap to per-class
   *  fetch on classId selection. */
  private loadAllExams(): void {
    this.isLoadingExams = true;
    this.api.getExams().subscribe({
      next: (res) => {
        this.allExams = Array.isArray(res?.data) ? res.data : [];
        this.isLoadingExams = false;
        this.recomputeExamTypeOptions();
      },
      error: () => { this.isLoadingExams = false; },
    });
  }

  // ── Recompute helpers (called only on real input changes) ─

  /** Distinct examType values present anywhere in the catalog.
   *  Only changes when allExams loads. */
  private recomputeExamTypeOptions(): void {
    const set = new Set<string>();
    for (const e of this.allExams) {
      if (e?.examType) set.add(e.examType);
    }
    this.examTypeOptions = Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /** Subjects that exist in the chosen examType + class + section.
   *  Recomputed only when one of those three fields changes. */
  private recomputeSubjectOptions(): void {
    if (!this.examType || !this.classId || !this.sectionId) {
      this.subjectOptions = [];
      return;
    }
    const map = new Map<string, string>();
    for (const e of this.allExams) {
      if (e?.examType !== this.examType) continue;
      if (e?.classId !== this.classId) continue;
      if (e?.sectionId !== this.sectionId) continue;
      if (e?.subjectId) {
        map.set(e.subjectId, e.subjectName || e.subjectId);
      }
    }
    this.subjectOptions = Array.from(map.entries())
      .map(([subjectId, subjectName]) => ({ subjectId, subjectName }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }

  /** Are all four scope fields set? Subject "" is valid (= All). */
  get scopeReady(): boolean {
    return !!this.examType && !!this.classId && !!this.sectionId;
  }

  // ── Cascade handlers ─────────────────────────────────────

  onExamTypeChange(): void {
    // Changing exam type invalidates class/section/subject choices
    // because the available subjects depend on the type.
    this.subjectId = '';
    this.preview = null;
    this.previewError = '';
    this.recomputeSubjectOptions();
  }

  onClassChange(): void {
    const cls = this.classes.find((c) => c.classId === this.classId);
    this.sections = (cls?.sections || []).map((s: any) => ({
      sectionId: s.sectionId || '',
      name: s.name,
    }));
    this.sectionId = '';
    this.subjectId = '';
    this.preview = null;
    this.previewError = '';
    this.recomputeSubjectOptions();
  }

  onSectionChange(): void {
    this.subjectId = '';
    this.preview = null;
    this.previewError = '';
    this.recomputeSubjectOptions();
  }

  onSubjectChange(): void {
    this.preview = null;
    this.previewError = '';
  }

  // ── Preview ──────────────────────────────────────────────

  loadPreview(): void {
    if (!this.scopeReady) return;
    this.previewError = '';
    this.isPreviewing = true;
    this.api.previewPublishResult(this.scope()).subscribe({
      next: (res) => {
        this.preview = res?.data || null;
        this.isPreviewing = false;
      },
      error: (err) => {
        this.preview = null;
        this.isPreviewing = false;
        this.previewError = err?.error?.message || 'Could not preview the publication.';
      },
    });
  }

  // ── Publish ──────────────────────────────────────────────

  /** Returns true if the same scope was published before — drives the
   *  warning banner and forces the admin to tick the Republish box. */
  get hasPriorPublication(): boolean {
    return !!this.preview?.alreadyPublishedAt;
  }

  /** Publish button is enabled when the scope is valid, the preview
   *  finished, and (if republishing) the box has been ticked. */
  get canPublish(): boolean {
    if (!this.scopeReady) return false;
    if (!this.preview) return false;
    if (this.isPublishing) return false;
    if (this.preview.studentCount === 0) return false;
    if (this.hasPriorPublication && !this.republish) return false;
    return true;
  }

  publish(): void {
    if (!this.canPublish || !this.preview) return;
    const ref: MatDialogRef<PublishResultConfirmDialogComponent, boolean> = this.dialog.open(
      PublishResultConfirmDialogComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          studentCount: this.preview.studentCount,
          parentCount: this.preview.parentCount,
          sampleTitle: this.preview.sampleTitle,
          republishing: this.hasPriorPublication,
        },
      },
    );
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.fireFanOut();
    });
  }

  private fireFanOut(): void {
    this.isPublishing = true;
    this.api.publishResult(this.scope(), this.republish).subscribe({
      next: (res) => {
        this.isPublishing = false;
        const r: PublishResultResult | undefined = res?.data;
        if (!r) {
          this.snackBar.open('Result published.', 'Close', { duration: 4000 });
          return;
        }
        const verb = r.republished ? 'Result re-published' : 'Result published';
        const msg = `${verb} — ${r.studentsNotified} student(s) and ${r.parentsNotified} parent(s) notified`
                  + (r.skippedStudents ? `, ${r.skippedStudents} skipped (no login).` : '.');
        this.snackBar.open(msg, 'Close', { duration: 6000 });
        // Refresh the preview so the prior-publication banner now reflects today.
        this.loadPreview();
      },
      error: (err) => {
        this.isPublishing = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to publish result.',
          'Close',
          { duration: 5000 },
        );
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────

  private scope(): PublishResultScope {
    return {
      examType: this.examType,
      classId: this.classId,
      sectionId: this.sectionId,
      subjectId: this.subjectId || null,
    };
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
