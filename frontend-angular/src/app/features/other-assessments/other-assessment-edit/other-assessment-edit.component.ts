import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';

interface SubjectRow {
  subjectId: string;
  subjectName: string;
  maxMarks: number | null;
  /** True when at least one student has a non-null mark for this
   *  subject on the current assessment. Locks the row's Remove
   *  button — parents may already have seen these marks. */
  hasMarks: boolean;
  /** True for rows that were on the doc when we loaded it. New
   *  rows added in this edit session have this false and can be
   *  removed freely. */
  existing: boolean;
}

/**
 * Edit an existing Other Assessment. Narrower than the create form —
 * only date and subjects change; name / type / class / section are
 * locked so historical marks stay attached to the assessment they
 * were entered against. The backend enforces the "can't remove a
 * subject with marks" rule; we mirror it in the UI (locked Remove
 * button + tooltip) so admins don't hit a 400 by surprise.
 */
@Component({
  selector: 'app-other-assessment-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './other-assessment-edit.component.html',
  styleUrl: './other-assessment-edit.component.scss',
})
export class OtherAssessmentEditComponent implements OnInit {
  assessmentId = '';
  isLoading = false;
  isSaving = false;

  assessment: any = null;
  testDate: Date = new Date();

  /** Union of subjects for the assessment's class in this academic
   *  year — used to populate the "Add Subjects" picker. */
  availableSubjects: any[] = [];
  subjectPickerModel: string[] = [];
  bulkMaxMarks: number | null = null;

  rows: SubjectRow[] = [];

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.assessmentId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.assessmentId) {
      this.router.navigate(['/other-assessments']);
      return;
    }
    this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.api.getOtherAssessment(this.assessmentId).subscribe({
      next: (res) => {
        this.assessment = res?.data;
        this.testDate = this.assessment?.testDate
            ? new Date(this.assessment.testDate) : new Date();
        this.rows = ((this.assessment?.subjects || []) as any[]).map((s) => ({
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          maxMarks: s.maxMarks ?? null,
          hasMarks: this.subjectHasMarks(s.subjectId),
          existing: true,
        }));
        this.loadAvailableSubjects();
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load assessment', 'Close', { duration: 3000 });
      },
    });
  }

  /** Check the assessment's students[] for any non-null mark on the
   *  given subject. Mirrors the backend's guard so the UI locks the
   *  Remove button rather than surprising the admin with a 400. */
  private subjectHasMarks(subjectId: string): boolean {
    const students = (this.assessment?.students || []) as any[];
    for (const st of students) {
      const marks = (st?.subjects || []) as any[];
      for (const m of marks) {
        if (m?.subjectId === subjectId && m?.marksObtained != null) return true;
      }
    }
    return false;
  }

  /** Load the class's subject list and filter it down to just the
   *  ones the assessment's section actually teaches. A section can
   *  override the class subject list via {@code Section.subjectIds}
   *  (elective config) — the create form respected this and the
   *  edit form has to too, otherwise a 12-B assessment's picker
   *  offers Mathematics even though 12-B doesn't teach it. */
  private loadAvailableSubjects(): void {
    const classId = this.assessment?.classId;
    const sectionId = this.assessment?.sectionId;
    const yearId = this.assessment?.academicYearId;
    if (!classId || !yearId) {
      this.availableSubjects = [];
      this.isLoading = false;
      return;
    }

    // Fetch the class in parallel with the class-level subject list.
    // Class carries the section's subjectIds override; the subject
    // service carries the raw subject records. Combining lets us
    // scope the picker properly.
    this.api.getClasses(yearId).subscribe({
      next: (classesRes) => {
        const classes = (classesRes?.data as any[]) || [];
        const cls = classes.find((c) => c.classId === classId);
        const section = (cls?.sections as any[] || [])
            .find((s) => s.sectionId === sectionId);
        const sectionOverride: string[] | undefined =
            Array.isArray(section?.subjectIds) && section.subjectIds.length > 0
                ? section.subjectIds : undefined;

        this.subjectService.getSubjectsByClassAndYear(classId, yearId).subscribe({
          next: (list) => {
            const classList = list || [];
            this.availableSubjects = sectionOverride
                ? classList.filter((s) => sectionOverride.includes(s.subjectId))
                : classList;
            this.isLoading = false;
          },
          error: () => {
            this.availableSubjects = [];
            this.isLoading = false;
          },
        });
      },
      error: () => {
        // Fall back to class-level list on classes fetch failure —
        // still narrower than showing every subject in the tenant.
        this.subjectService.getSubjectsByClassAndYear(classId, yearId).subscribe({
          next: (list) => {
            this.availableSubjects = list || [];
            this.isLoading = false;
          },
          error: () => {
            this.availableSubjects = [];
            this.isLoading = false;
          },
        });
      },
    });
  }

  /** Options the admin can still add — everything in the class's
   *  subject list minus what's already on the assessment. */
  get pickableSubjects(): any[] {
    const taken = new Set(this.rows.map((r) => r.subjectId));
    return this.availableSubjects.filter((s) => !taken.has(s.subjectId));
  }

  onSubjectsPicked(pickedIds: string[]): void {
    const already = new Set(this.rows.map((r) => r.subjectId));
    for (const id of pickedIds) {
      if (already.has(id)) continue;
      const src = this.availableSubjects.find((s) => s.subjectId === id);
      if (!src) continue;
      this.rows.push({
        subjectId: id,
        subjectName: src.name,
        maxMarks: null,
        hasMarks: false,
        existing: false,
      });
    }
    setTimeout(() => { this.subjectPickerModel = []; });
  }

  removeRow(i: number): void {
    const row = this.rows[i];
    if (!row || row.hasMarks) return;
    this.rows.splice(i, 1);
  }

  applyBulkMaxMarks(): void {
    if (this.bulkMaxMarks == null || this.bulkMaxMarks <= 0) return;
    for (const r of this.rows) r.maxMarks = this.bulkMaxMarks;
  }

  canSave(): boolean {
    if (this.isSaving) return false;
    if (!this.testDate) return false;
    if (this.rows.length === 0) return false;
    return this.rows.every((r) => r.subjectId && r.maxMarks && r.maxMarks > 0);
  }

  save(): void {
    if (!this.canSave()) return;
    this.isSaving = true;
    this.api.updateOtherAssessment(this.assessmentId, {
      testDate: this.formatDate(this.testDate),
      subjects: this.rows.map((r) => ({
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        maxMarks: r.maxMarks,
      })),
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Assessment updated', 'Close', { duration: 2500 });
        this.router.navigate(['/other-assessments']);
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Update failed', 'Close', { duration: 3500 });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/other-assessments']);
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
