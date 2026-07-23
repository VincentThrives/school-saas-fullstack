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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

/**
 * Admin list of Other Assessments — non-academic tests (CET weekly,
 * mock exams, etc.) stored in a dedicated collection so they don't
 * clutter the regular Exams page or affect report cards.
 */
@Component({
  selector: 'app-other-assessments-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './other-assessments-list.component.html',
  styleUrl: './other-assessments-list.component.scss',
})
export class OtherAssessmentsListComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  sections: { name: string; sectionId?: string }[] = [];

  selectedAcademicYearId = '';
  selectedClassId = '';
  selectedSectionId = '';
  typeFilter = '';

  assessments: any[] = [];
  isLoading = false;

  /** When true, the list swaps to soft-deleted rows only. Same year /
   *  class / section / type filters apply — powers the admin's
   *  Archive view + Restore action. */
  showArchived = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = res.data || [];
        const current = this.academicYears.find((y) => y.current) || this.academicYears[0];
        if (current) {
          this.selectedAcademicYearId = current.academicYearId;
          this.loadClasses();
          // Default to the year-wide view — admin lands on the page
          // and sees every assessment right away instead of an empty
          // list until they pick a class.
          this.loadAssessments();
        }
      },
    });
  }

  private loadClasses(): void {
    this.api.getClasses(this.selectedAcademicYearId).subscribe({
      next: (res) => { this.classes = res.data || []; },
    });
  }

  onYearChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.sections = [];
    this.assessments = [];
    if (this.selectedAcademicYearId) this.loadClasses();
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    const cls = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = this.selectedClassId
        ? ((cls?.sections as any[]) || []).map((s: any) => ({
              name: s.name, sectionId: s.sectionId,
          }))
        : [];
    this.loadAssessments();
  }

  onSectionChange(): void { this.loadAssessments(); }
  onTypeChange(): void { this.loadAssessments(); }

  private loadAssessments(): void {
    if (!this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.api.listOtherAssessments(
        this.selectedClassId,           // may be '' → All classes
        this.selectedAcademicYearId,
        this.selectedSectionId || undefined,
        this.typeFilter || undefined,
        this.showArchived).subscribe({
      next: (res) => {
        this.assessments = (res?.data as any[]) || [];
        this.isLoading = false;
      },
      error: () => {
        this.assessments = [];
        this.isLoading = false;
      },
    });
  }

  onArchivedToggle(): void {
    this.loadAssessments();
  }

  /** Restore a previously-archived assessment — clears deletedAt on
   *  the backend and reloads the current view. */
  onRestore(a: any, event: Event): void {
    event.stopPropagation();
    this.api.restoreOtherAssessment(a.assessmentId).subscribe({
      next: () => {
        this.snackBar.open('Assessment restored', 'Close', { duration: 2500 });
        this.loadAssessments();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Restore failed', 'Close', { duration: 3000 });
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/other-assessments/new'], {
      queryParams: {
        classId: this.selectedClassId,
        sectionId: this.selectedSectionId,
        academicYearId: this.selectedAcademicYearId,
      },
    });
  }

  onOpen(a: any): void {
    this.router.navigate(['/other-assessments', a.assessmentId]);
  }

  onEdit(a: any, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/other-assessments', a.assessmentId, 'edit']);
  }

  /** True when any student on this assessment has at least one mark
   *  entered. Drives the row-level Notify button's enabled state so
   *  admins can't fire empty-body notifications by mistake. Cheap
   *  client-side check — the list endpoint already returns full
   *  student rows so no extra call needed. */
  hasAnyMarks(a: any): boolean {
    const students = a?.students as any[] | undefined;
    if (!students || students.length === 0) return false;
    for (const s of students) {
      const subs = s?.subjects as any[] | undefined;
      if (!subs) continue;
      for (const m of subs) {
        if (m?.marksObtained !== null && m?.marksObtained !== undefined) return true;
      }
    }
    return false;
  }

  // ── Notify dialog state ──────────────────────────────────────

  notifyDialogOpen = false;
  notifyTarget: any = null;
  notifyPreview: {
    title: string;
    body: string;
    sampleStudentName: string | null;
    studentCount: number;
    parentCount: number;
    totalRecipients: number;
  } | null = null;
  isPreviewingNotify = false;
  isSendingNotify = false;

  onNotify(a: any, event: Event): void {
    event.stopPropagation();
    if (!this.hasAnyMarks(a)) return;
    this.notifyTarget = a;
    this.notifyDialogOpen = true;
    this.notifyPreview = null;
    this.isPreviewingNotify = true;
    this.api.previewOtherAssessmentNotify(a.assessmentId).subscribe({
      next: (res) => {
        this.notifyPreview = res?.data || null;
        this.isPreviewingNotify = false;
      },
      error: (err) => {
        this.isPreviewingNotify = false;
        this.snackBar.open(err?.error?.message || 'Preview failed',
            'Close', { duration: 3500 });
        this.notifyDialogOpen = false;
        this.notifyTarget = null;
      },
    });
  }

  closeNotifyDialog(): void {
    if (this.isSendingNotify) return;
    this.notifyDialogOpen = false;
    this.notifyTarget = null;
    this.notifyPreview = null;
  }

  confirmNotify(): void {
    if (!this.notifyTarget || !this.notifyPreview || this.isSendingNotify) return;
    this.isSendingNotify = true;
    this.api.sendOtherAssessmentNotify(this.notifyTarget.assessmentId).subscribe({
      next: (res) => {
        this.isSendingNotify = false;
        const r = res?.data || {};
        const students = r.notifiedStudents ?? 0;
        const parents = r.notifiedParents ?? 0;
        this.snackBar.open(
            `Sent to ${students} student${students === 1 ? '' : 's'}`
            + (parents > 0 ? ` + ${parents} parent${parents === 1 ? '' : 's'}` : ''),
            'Close', { duration: 3500 });
        this.notifyDialogOpen = false;
        this.notifyTarget = null;
        this.notifyPreview = null;
      },
      error: (err) => {
        this.isSendingNotify = false;
        this.snackBar.open(err?.error?.message || 'Send failed',
            'Close', { duration: 4000 });
      },
    });
  }

  // ── Delete dialog state ──────────────────────────────────────

  deleteDialogOpen = false;
  deleteTarget: any = null;
  deleteHasMarks = false;
  isDeleting = false;

  onDelete(a: any, event: Event): void {
    event.stopPropagation();
    this.deleteTarget = a;
    this.deleteHasMarks = false;
    this.deleteDialogOpen = true;
    // Check server-side whether any marks were entered so the dialog
    // can show a stronger warning + require confirmation for hard
    // delete without loading the whole assessment doc.
    this.api.getOtherAssessmentMarksStatus(a.assessmentId).subscribe({
      next: (res) => { this.deleteHasMarks = !!res?.data?.hasAnyMarks; },
      error: () => { this.deleteHasMarks = false; },
    });
  }

  closeDeleteDialog(): void {
    if (this.isDeleting) return;
    this.deleteDialogOpen = false;
    this.deleteTarget = null;
    this.deleteHasMarks = false;
  }

  /** Soft delete — archive but keep row in DB for restore / audit. */
  confirmArchive(): void {
    if (!this.deleteTarget || this.isDeleting) return;
    this.isDeleting = true;
    this.api.deleteOtherAssessment(this.deleteTarget.assessmentId, false).subscribe({
      next: () => {
        this.isDeleting = false;
        this.snackBar.open('Assessment archived', 'Close', { duration: 2500 });
        this.deleteDialogOpen = false;
        this.deleteTarget = null;
        this.loadAssessments();
      },
      error: (err) => {
        this.isDeleting = false;
        this.snackBar.open(err?.error?.message || 'Archive failed', 'Close', { duration: 3000 });
      },
    });
  }

  /** Hard delete — full removal from Mongo. Only allowed after the
   *  admin explicitly picks "Delete permanently" on the dialog. */
  confirmHardDelete(): void {
    if (!this.deleteTarget || this.isDeleting) return;
    const label = this.deleteTarget.name || 'this assessment';
    if (this.deleteHasMarks) {
      // Extra confirmation — marks were entered, permanent delete
      // wipes them for good.
      const ok = confirm(
          `"${label}" already has marks entered. `
          + `Permanent delete will remove them forever. Continue?`);
      if (!ok) return;
    }
    this.isDeleting = true;
    this.api.deleteOtherAssessment(this.deleteTarget.assessmentId, true).subscribe({
      next: () => {
        this.isDeleting = false;
        this.snackBar.open('Assessment deleted permanently', 'Close', { duration: 2500 });
        this.deleteDialogOpen = false;
        this.deleteTarget = null;
        this.loadAssessments();
      },
      error: (err) => {
        this.isDeleting = false;
        this.snackBar.open(err?.error?.message || 'Delete failed', 'Close', { duration: 3000 });
      },
    });
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined,
        { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Resolve a class id → its display name using the classes list
   *  already loaded for this year. Falls back to the raw id when the
   *  class isn't found (deleted class, cross-year drift). Reads from
   *  the cached classes array so no extra API traffic. */
  classNameFor(classId: string): string {
    if (!classId) return '';
    const cls = this.classes.find((c) => c.classId === classId);
    return cls?.name || classId;
  }

  /** Resolve a section id (scoped to its class) → display name. */
  sectionNameFor(classId: string, sectionId: string): string {
    if (!classId || !sectionId) return '';
    const cls = this.classes.find((c) => c.classId === classId);
    const sec = (cls?.sections as any[] || []).find((s) => s.sectionId === sectionId);
    return sec?.name || '';
  }
}
