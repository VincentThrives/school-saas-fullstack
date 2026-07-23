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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

interface SectionOption {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  /** "{class} - {section}" label so the multi-select reads clearly
   *  when the admin ticks sections from more than one class. */
  label: string;
  /** Composite value used by the mat-select so classId + sectionId
   *  travel together as a single string ("classId::sectionId"). */
  value: string;
  /** Section-level elective override — when populated, only these
   *  subject ids apply to this section (rest of the class list is
   *  excluded). Empty / null → section inherits every class subject. */
  subjectIdsOverride?: string[];
}

interface SubjectRow {
  subjectId: string;
  subjectName: string;
  maxMarks: number | null;
}

/**
 * Create form for a new Other Assessment. Supports fan-out to
 * multiple classes and sections in one save — for a school running
 * CET Week 1 across 11-A / 11-B / 12-A simultaneously, the admin
 * ticks all three sections and gets three assessment docs seeded
 * with the same subject list.
 */
@Component({
  selector: 'app-other-assessment-form',
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
    MatSnackBarModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './other-assessment-form.component.html',
  styleUrl: './other-assessment-form.component.scss',
})
export class OtherAssessmentFormComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  /** Every section under the currently-picked classes, flattened so
   *  a single multi-select picker can show them all with a class
   *  prefix. */
  sectionOptions: SectionOption[] = [];
  availableSubjects: any[] = [];

  selectedAcademicYearId = '';
  /** Multi — one or more class ids. Sections list re-computes from
   *  whichever classes are ticked. */
  selectedClassIds: string[] = [];
  /** Multi — composite "classId::sectionId" values so a section
   *  from 11 doesn't collide with a section from 12 that happens
   *  to share sectionId in a mis-configured tenant. */
  selectedSectionValues: string[] = [];
  name = '';
  type = '';
  testDate: Date = new Date();

  subjects: SubjectRow[] = [];
  isSaving = false;

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // Preload from query params if the admin clicked "New Assessment"
    // from the list page — keeps the class/section context so they
    // don't re-pick after landing.
    const qp = this.route.snapshot.queryParams;
    this.selectedAcademicYearId = qp['academicYearId'] || '';
    const seedClassId = qp['classId'];
    const seedSectionId = qp['sectionId'];

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = res.data || [];
        if (!this.selectedAcademicYearId) {
          const current = this.academicYears.find((y) => y.current) || this.academicYears[0];
          if (current) this.selectedAcademicYearId = current.academicYearId;
        }
        if (this.selectedAcademicYearId) {
          this.loadClasses(seedClassId, seedSectionId);
        }
      },
    });
  }

  private loadClasses(seedClassId?: string, seedSectionId?: string): void {
    this.api.getClasses(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.classes = res.data || [];
        if (seedClassId) this.selectedClassIds = [seedClassId];
        this.recomputeSectionOptions();
        if (seedClassId && seedSectionId) {
          const val = `${seedClassId}::${seedSectionId}`;
          if (this.sectionOptions.some((o) => o.value === val)) {
            this.selectedSectionValues = [val];
          }
        }
        this.reloadSubjects();
      },
    });
  }

  onYearChange(): void {
    this.selectedClassIds = [];
    this.selectedSectionValues = [];
    this.sectionOptions = [];
    this.availableSubjects = [];
    this.subjects = [];
    if (this.selectedAcademicYearId) this.loadClasses();
  }

  onClassChange(): void {
    this.recomputeSectionOptions();
    // Drop section picks that no longer belong to any selected class.
    const valid = new Set(this.sectionOptions.map((o) => o.value));
    this.selectedSectionValues = this.selectedSectionValues.filter((v) => valid.has(v));
    this.reloadSubjects();
  }

  /** Re-scope the subject picker when the admin ticks / unticks a
   *  section — no need to re-fetch class subjects, just re-project
   *  the union across the newly-picked sections. */
  onSectionChange(): void {
    this.rebuildAvailableSubjects();
  }

  private recomputeSectionOptions(): void {
    const opts: SectionOption[] = [];
    for (const cls of this.classes) {
      if (!this.selectedClassIds.includes(cls.classId)) continue;
      const sections = ((cls.sections as any[]) || []);
      for (const s of sections) {
        const value = `${cls.classId}::${s.sectionId}`;
        opts.push({
          classId: cls.classId,
          className: cls.name,
          sectionId: s.sectionId,
          sectionName: s.name,
          value,
          // "11 - A" if multiple classes ticked; just "A" if only one.
          label: this.selectedClassIds.length > 1
              ? `${cls.name} - ${s.name}`
              : s.name,
          subjectIdsOverride: Array.isArray(s.subjectIds) && s.subjectIds.length > 0
              ? [...s.subjectIds]
              : undefined,
        });
      }
    }
    this.sectionOptions = opts;
  }

  /** Per-class subject cache — key is classId, value is that class's
   *  subject list. Populated by {@link reloadSubjects}; consumed by
   *  {@link save} so each fan-out doc lands with the LOCAL subjectId
   *  for its class (same-named subjects in different classes have
   *  different subjectIds and shouldn't cross-pollinate). */
  private subjectsByClass = new Map<string, any[]>();

  /** Per-section effective subject list — key is "classId::sectionId".
   *  If a Section has a non-empty {@code subjectIds} list, only those
   *  subjects apply to that section (elective override); otherwise
   *  the section takes the full class subject list. Populated in
   *  {@link recomputeSectionOptions} and consumed everywhere else. */
  private subjectsBySectionValue = new Map<string, any[]>();

  /** Union of subjects across every picked SECTION, matched by
   *  case-insensitive name. Each section's effective subject list
   *  respects its own {@code subjectIds} override — so a 12-B section
   *  configured with only Physics + Chemistry contributes only those
   *  subjects to the union, not the full 12th class list.
   *
   *  <p>Each option carries a scope label naming the section(s) it
   *  applies to — "Mathematics (12th - A)" so the admin can tell at
   *  a glance that ticking Mathematics won't create a Mathematics row
   *  on the 12-B assessment.</p>
   */
  private reloadSubjects(): void {
    this.subjectsByClass.clear();
    this.subjectsBySectionValue.clear();
    if (this.selectedClassIds.length === 0) {
      this.availableSubjects = [];
      return;
    }
    const calls = this.selectedClassIds.map((cid) =>
        this.subjectService.getSubjectsByClassAndYear(cid, this.selectedAcademicYearId));
    forkJoin(calls).subscribe({
      next: (results) => {
        this.selectedClassIds.forEach((cid, i) => {
          this.subjectsByClass.set(cid, results[i] || []);
        });

        // Build the effective subject list per SECTION — start with
        // the section's class subjects, then filter down if the
        // section has a subjectIds override list.
        for (const opt of this.sectionOptions) {
          const classList = this.subjectsByClass.get(opt.classId) || [];
          const list = opt.subjectIdsOverride
              ? classList.filter((s) => opt.subjectIdsOverride!.includes(s.subjectId))
              : classList;
          this.subjectsBySectionValue.set(opt.value, list);
        }

        this.rebuildAvailableSubjects();
      },
      error: () => {
        this.subjectsByClass.clear();
        this.subjectsBySectionValue.clear();
        this.availableSubjects = [];
      },
    });
  }

  /** Recompute the picker's option list from the current section
   *  ticks. Kept separate from {@link reloadSubjects} because a
   *  section-tick change should re-scope subjects without re-hitting
   *  the /subjects endpoint for the classes we already have cached. */
  private rebuildAvailableSubjects(): void {
    const norm = (n: string | undefined) => (n || '').toLowerCase().trim();

    // Group by lowercased name; track which SECTIONS have each subject.
    const byName = new Map<string, {
      name: string;
      sectionValues: string[];
      anySubjectId: string;
    }>();

    const targets = this.selectedSectionValues.length > 0
        ? this.selectedSectionValues
        : this.sectionOptions.map((o) => o.value);

    for (const sv of targets) {
      const list = this.subjectsBySectionValue.get(sv) || [];
      for (const s of list) {
        const key = norm(s?.name);
        if (!key || !s?.subjectId) continue;
        const entry = byName.get(key);
        if (entry) {
          if (!entry.sectionValues.includes(sv)) entry.sectionValues.push(sv);
        } else {
          byName.set(key, {
            name: s.name,
            sectionValues: [sv],
            anySubjectId: s.subjectId,
          });
        }
      }
    }

    const labelBySectionValue = new Map<string, string>();
    for (const opt of this.sectionOptions) {
      labelBySectionValue.set(
          opt.value,
          this.selectedClassIds.length > 1
              ? `${opt.className} - ${opt.sectionName}`
              : opt.sectionName);
    }

    const showScope = targets.length > 1;
    const merged: any[] = [];
    for (const entry of byName.values()) {
      const orderedLabels = targets
          .filter((sv) => entry.sectionValues.includes(sv))
          .map((sv) => labelBySectionValue.get(sv) || sv);
      const scopeText = showScope
          ? ' (' + orderedLabels.join(', ') + ')'
          : '';
      merged.push({
        subjectId: entry.anySubjectId,
        name: entry.name,
        displayLabel: entry.name + scopeText,
        scopeLabel: scopeText.trim(),
        sectionValues: [...entry.sectionValues],
      });
    }
    merged.sort((a, b) => a.name.localeCompare(b.name));
    this.availableSubjects = merged;

    // Drop already-added rows whose subject no longer exists in any
    // of the currently-picked sections.
    this.subjects = this.subjects.filter(
        (r) => !r.subjectName || byName.has(norm(r.subjectName)));
  }

  /** Scope label for an already-added subject row — matches the
   *  picker's "(11th)" hint so the admin still sees which classes
   *  the subject will apply to after they add it. */
  scopeFor(subjectName: string): string {
    const norm = (n: string | undefined) => (n || '').toLowerCase().trim();
    const key = norm(subjectName);
    const opt = this.availableSubjects.find((s) => norm(s.name) === key);
    return opt?.scopeLabel || '';
  }

  // ── Subject picker (multi-add) ────────────────────────────────

  /** Batch-add every subject the admin ticks, with a default max
   *  marks value. Skips subjects already added so re-picking the
   *  same one doesn't produce duplicates. Called from the
   *  "Add Subjects" multi-select's (selectionChange). */
  onSubjectsPicked(pickedIds: string[]): void {
    const already = new Set(this.subjects.map((r) => r.subjectId));
    for (const id of pickedIds) {
      if (already.has(id)) continue;
      const src = this.availableSubjects.find((s) => s.subjectId === id);
      if (!src) continue;
      this.subjects.push({
        subjectId: id,
        subjectName: src.name,
        maxMarks: null,
      });
    }
    // Clear the picker so it resets to "Add Subjects" and the user
    // can tick another batch later without unchecking first.
    setTimeout(() => { this.subjectPickerModel = []; });
  }

  /** Bound to the multi-select so we can reset it after a batch. */
  subjectPickerModel: string[] = [];

  /** Bulk max-marks value — the admin types once and clicks
   *  "Apply to all" to stamp every existing subject row. Independent
   *  from per-row inputs so a stray keystroke here doesn't clobber
   *  individual overrides until the button is pressed. */
  bulkMaxMarks: number | null = null;

  applyBulkMaxMarks(): void {
    if (this.bulkMaxMarks == null || this.bulkMaxMarks <= 0) return;
    for (const s of this.subjects) s.maxMarks = this.bulkMaxMarks;
  }

  removeSubject(i: number): void {
    this.subjects.splice(i, 1);
  }

  /** Subjects still available to add (not yet in the marks list). */
  get pickableSubjects(): any[] {
    const already = new Set(this.subjects.map((r) => r.subjectId));
    return this.availableSubjects.filter((s) => !already.has(s.subjectId));
  }

  // ── Save ──────────────────────────────────────────────────────

  canSave(): boolean {
    if (this.isSaving) return false;
    if (this.selectedClassIds.length === 0
        || this.selectedSectionValues.length === 0
        || !this.selectedAcademicYearId
        || !this.name.trim()
        || !this.testDate) return false;
    if (this.subjects.length === 0) return false;
    return this.subjects.every((s) => s.subjectId && s.maxMarks && s.maxMarks > 0);
  }

  save(): void {
    if (!this.canSave()) return;
    this.isSaving = true;

    // Fan out — one assessment doc per (class, section) combo the
    // admin ticked. Same name / type / date / subject list on each,
    // BUT each class resolves each subject name to its OWN subjectId
    // via subjectsByClass. Same-named subjects in different classes
    // typically have distinct subjectIds; passing the picker's
    // placeholder id (from the first class) to every class would
    // wire the wrong id onto other classes' assessment docs.
    const dateStr = this.formatDate(this.testDate);
    const nameTrim = this.name.trim();
    const typeTrim = this.type.trim() || null;

    const targets = this.sectionOptions.filter(
        (o) => this.selectedSectionValues.includes(o.value));

    const norm = (n: string | undefined) => (n || '').toLowerCase().trim();

    const calls = targets
        .map((t) => {
          // Use the SECTION's effective subject list (which already
          // respects section.subjectIds elective overrides) rather
          // than the whole class list — a section configured to skip
          // Mathematics won't get a Mathematics row silently added.
          const sectionSubjects = this.subjectsBySectionValue.get(t.value) || [];
          const subjectsPayload = this.subjects
              .map((s) => {
                const nameKey = norm(s.subjectName);
                const local = sectionSubjects.find((cs) => norm(cs?.name) === nameKey);
                if (!local) return null;   // this section doesn't teach it → skip
                return {
                  subjectId: local.subjectId,
                  subjectName: s.subjectName,
                  maxMarks: s.maxMarks,
                };
              })
              .filter((x): x is any => x !== null);
          if (subjectsPayload.length === 0) return null;   // nothing to save for this section
          return this.api.createOtherAssessment({
            academicYearId: this.selectedAcademicYearId,
            classId: t.classId,
            sectionId: t.sectionId,
            name: nameTrim,
            type: typeTrim,
            testDate: dateStr,
            subjects: subjectsPayload,
          });
        })
        .filter((x): x is any => x !== null);

    if (calls.length === 0) {
      this.isSaving = false;
      this.snackBar.open(
          'No matching subjects for any picked class.',
          'Close', { duration: 3500 });
      return;
    }

    forkJoin(calls).subscribe({
      next: (results) => {
        this.isSaving = false;
        const created = results.length;
        this.snackBar.open(
            created === 1 ? 'Assessment created' : `${created} assessments created`,
            'Close', { duration: 2500 });
        // Land on the detail page when only one section was picked
        // (admin can start entering marks). Multiple → back to list.
        if (created === 1) {
          const id = (results[0] as any)?.data?.assessmentId;
          if (id) {
            this.router.navigate(['/other-assessments', id]);
            return;
          }
        }
        this.router.navigate(['/other-assessments']);
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(
            err?.error?.message || 'Failed to create',
            'Close', { duration: 3500 });
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
