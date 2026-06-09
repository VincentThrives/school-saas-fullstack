import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ApiService } from '../../core/services/api.service';
import { SubjectService } from '../../core/services/subject.service';
import {
  TeacherSubjectAssignment,
  TeacherAssignmentRole,
  CreateTeacherAssignmentRequest,
  Teacher,
  SchoolClass,
  AcademicYear,
} from '../../core/models';

interface TeacherLite { teacherId: string; name: string; }
interface SectionLite { sectionId: string; name: string; subjectIds?: string[]; }

@Component({
  selector: 'app-teacher-assignments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './teacher-assignments.component.html',
  styleUrl: './teacher-assignments.component.scss',
})
export class TeacherAssignmentsComponent implements OnInit {
  // Reference data
  teachers: TeacherLite[] = [];
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];

  // Top bar filters
  selectedAcademicYearId = '';
  filterClassId = '';
  filterSectionId = '';
  filterTeacherId = '';
  searchQuery = '';

  filterClassOptions: SchoolClass[] = [];
  filterSectionOptions: SectionLite[] = [];

  /** True when the selected AY has zero classes — show a hint in the UI. */
  get noClassesForYear(): boolean {
    return !!this.selectedAcademicYearId && this.filterClassOptions.length === 0;
  }

  // Full list vs. filtered view
  private allAssignments: TeacherSubjectAssignment[] = [];

  // Table
  dataSource = new MatTableDataSource<TeacherSubjectAssignment>([]);
  displayedColumns = ['teacher', 'class', 'section', 'subject', 'roles', 'actions'];
  isLoading = false;

  // Form (right panel / modal)
  formOpen = false;
  isSaving = false;
  editingId: string | null = null;
  formTeacherId = '';

  // Create mode: multi-select (arrays). Edit mode: single-value reused.
  formClassIds: string[] = [];
  formSectionIds: string[] = [];

  // Single-value fields still used in edit mode + for the Class Teacher picker.
  formClassId = '';
  formSectionId = '';
  formSubjectId = '';
  /**
   * componentKey for the SUBJECT_TEACHER assignment being EDITED.
   * Edit mode is single-row, so a single key is sufficient. Null for
   * single-component subjects and CLASS_TEACHER-only rows; the backend
   * auto-fills or ignores accordingly.
   */
  formComponentKey: string | null = null;
  /**
   * Create-mode multi-select: one teacher can own Theory + IA in one go.
   * Each picked component fans out to its own SUBJECT_TEACHER row at
   * save time (one row per (class × section × component)). Empty means
   * "let the backend auto-fill" — only valid when the subject has a
   * single eligible component, or all eligible ones should be assigned.
   */
  formComponentKeys: string[] = [];
  /** Components on the currently-chosen subject (for the picker). */
  formComponentChoices: Array<{ key: string; label: string }> = [];
  formRoleClass = false;
  formRoleSubject = true;

  /** When Class Teacher is ticked, the admin must explicitly pick
   *  one class + one section for that role (independent of the multi-select above). */
  classTeacherClassId = '';
  classTeacherSectionId = '';

  formClassOptions: SchoolClass[] = [];
  formSectionOptions: SectionLite[] = [];
  formSubjectOptions: { id: string; name: string }[] = [];
  /** Raw subject metadata kept around so we can re-derive
   *  {@link formSubjectOptions} whenever either subjects OR classes
   *  arrive — order doesn't matter, both feed the label rebuild. */
  private rawSubjects: Array<{
    id: string;
    name: string;
    assignments: any[];
    /** Components on the subject — used to disambiguate the dropdown
     *  label when two same-named subjects differ in component shape. */
    components?: any[];
  }> = [];

  /** Flat list of (class, section) pairs for the multi-select in create mode.
   *  Values are encoded as "classId::sectionId" so each pair is distinct.
   *  {@link search} is a pre-lowercased blob so typing "1a" / "1 a" / "a 1" all match. */
  formClassSectionOptions: {
    key: string;
    classId: string;
    sectionId: string;
    classLabel: string;
    sectionLabel: string;
    label: string;
    search: string;
  }[] = [];
  /** Selected "classId::sectionId" keys. */
  formClassSectionKeys: string[] = [];
  /** Search box text for the searchable class-section dropdown. */
  classSectionSearch = '';

  /** Subject-id → list of class-section keys where that subject exists.
   *  Built once per (year, classes-loaded) and used to:
   *    1. Populate the Subject dropdown (keys of this map).
   *    2. Filter the Classes & Sections dropdown to only pairs that teach
   *       the currently-picked subject. */
  private subjectToPairKeys = new Map<string, Set<string>>();

  /** Raw list of Subject rows for the selected academic year. Loaded once
   *  per year from GET /api/v1/subjects. Primary source for the Subject
   *  dropdown (the Classes model's inline subjectIds is a secondary hint). */
  private allSubjectsForYear: any[] = [];

  /** Free-text search inside the Subject dropdown. */
  subjectSearch = '';

  /** Precomputed sections for the Class Teacher sub-panel. A getter here
   *  caused infinite change-detection in mat-select. */
  classTeacherSectionOptions: SectionLite[] = [];

  // Delete
  deleteDialogOpen = false;
  deleteTarget: TeacherSubjectAssignment | null = null;
  isDeleting = false;

  // Carry-forward dialog
  carryOpen = false;
  carryFromYearId = '';
  carryToYearId = '';
  isCarrying = false;

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // Force SubjectService to drop its cache + fetch fresh. Without this,
    // the service serves whatever it loaded on the first page visit and
    // never picks up subjects the admin adds later in this session.
    this.subjectService.refreshSubjects();

    // Also fetch subjects directly from the same endpoint the Subjects
    // sidenav page uses — guarantees the dropdown is populated even if the
    // shared service hasn't pushed a new value yet.
    this.loadSubjectsDirect();

    // Then bind to the shared service so future updates from Subjects page
    // propagate here live. Pass assignments through so applySubjectOptions
    // can disambiguate duplicate names with a class-list suffix.
    this.subjectService.getSubjects().subscribe((list) => {
      if (!list || list.length === 0) return;
      this.applySubjectOptions(list.map(s => ({
        id: s.subjectId,
        name: s.name,
        assignments: (s as any).assignments || [],
        components: (s as any).components || [],
      })));
    });
    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
      this.recomputeFormClassOptions();
      this.recomputeFilterClassOptions();
      this.recomputeFormSectionOptions();
      // Classes may have loaded AFTER the subject list — in that case the
      // earlier applySubjectOptions ran with an empty classes array and the
      // disambiguation suffix came out blank. Rebuild labels now that
      // classes are available so duplicate names finally show their class
      // suffix.
      this.rebuildSubjectOptionLabels();
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) this.selectedAcademicYearId = current.academicYearId;
      this.recomputeFilterClassOptions();
      this.loadSubjectsForYear();
      this.loadAssignments();
    });
    this.loadTeachers();

    // Search filter predicate on the table data source.
    // Matches against teacher name, class, section, subject, AND role labels
    // (so typing "class teacher" / "subject" filters by role too).
    this.dataSource.filterPredicate = (a: TeacherSubjectAssignment, filter: string) => {
      if (!filter) return true;
      const t = this.teacherName(a.teacherId).toLowerCase();
      const c = this.classLabel(a).toLowerCase();
      const s = this.sectionLabel(a).toLowerCase();
      const subj = this.subjectLabel(a).toLowerCase();
      const roles = this.rolesLabel(a.roles).join(' ').toLowerCase();
      return (t + ' ' + c + ' ' + s + ' ' + subj + ' ' + roles).includes(filter);
    };
  }

  // ── Data loads ─────────────────────────────────────────────────────

  loadTeachers(): void {
    this.api.getTeachers(0, 500).subscribe({
      next: (res) => {
        const list = res.data?.content || [];
        this.teachers = list.map((t: Teacher) => ({
          teacherId: (t as any).teacherId,
          name: `${(t as any).firstName || ''} ${(t as any).lastName || ''}`.trim() || (t as any).employeeId || 'Teacher',
        }));
      },
    });
  }

  loadAssignments(): void {
    if (!this.selectedAcademicYearId) { this.allAssignments = []; this.dataSource.data = []; return; }
    this.isLoading = true;
    this.api.getTeacherAssignments({ academicYearId: this.selectedAcademicYearId }).subscribe({
      next: (res) => {
        this.allAssignments = res.data || [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => { this.allAssignments = []; this.dataSource.data = []; this.isLoading = false; },
    });
  }

  onYearChange(): void {
    this.filterClassId = '';
    this.filterSectionId = '';
    this.filterTeacherId = '';
    this.searchQuery = '';
    this.recomputeFilterClassOptions();
    this.filterSectionOptions = [];
    // Rebuild form option lists so the create dialog reflects the new year
    // next time it opens.
    this.recomputeFormClassOptions();
    this.loadSubjectsForYear();
    this.loadAssignments();
  }

  /** Fetch the canonical Subject rows for the selected academic year.
   *  The Subjects module is the primary source — not section.subjectIds. */
  private loadSubjectsForYear(): void {
    this.allSubjectsForYear = [];
    if (!this.selectedAcademicYearId) {
      this.recomputeFormSectionOptions();
      return;
    }
    // The /subjects endpoint returns all rows when classId+academicYearId
    // aren't both supplied. Pull everything and filter client-side by AY.
    this.http.get<any>('/api/v1/subjects').subscribe({
      next: (res: any) => {
        const all = res?.data || [];
        this.allSubjectsForYear = all.filter((s: any) =>
          !s.academicYearId || s.academicYearId === this.selectedAcademicYearId);
        this.recomputeFormSectionOptions();

        // Also feed the Subject dropdown directly from this response so it
        // surfaces all subjects the admin configured on the Subjects page —
        // regardless of whether they were wired to a class yet.
        this.applySubjectOptions(all
          .filter((s: any) => !!(s.subjectId || s.id) && !!s.name)
          .map((s: any) => ({ id: s.subjectId || s.id, name: s.name })));
      },
      error: () => {
        this.allSubjectsForYear = [];
        this.recomputeFormSectionOptions();
      },
    });
  }

  /** Direct uncached fetch from the same endpoint the Subjects sidenav page
   *  uses. Populates the Subject dropdown immediately on page open. */
  private loadSubjectsDirect(): void {
    this.http.get<any>('/api/v1/subjects').subscribe({
      next: (res: any) => {
        const all = res?.data || [];
        if (all.length > 0) {
          const rawList = all
            .filter((s: any) => !!(s.subjectId || s.id) && !!s.name)
            .map((s: any) => ({
              id: s.subjectId || s.id,
              name: s.name as string,
              // Carry assignments + components through so applySubjectOptions
              // can disambiguate duplicate names with class AND component info.
              assignments: Array.isArray(s.assignments) ? s.assignments : [],
              components: Array.isArray(s.components) ? s.components : [],
            }));
          this.applySubjectOptions(rawList);
        }
      },
      error: () => { /* SubjectService subscription will fill in the fallback */ },
    });
  }

  /**
   * Cache a fresh batch of subjects into {@link rawSubjects} (de-duped by
   * id) and rebuild the dropdown labels. Called from both load paths
   * (direct API fetch + SubjectService broadcast). Idempotent — the
   * lookup map dedupes regardless of which source fired first.
   */
  private applySubjectOptions(list: Array<{ id: string; name: string; assignments?: any[]; components?: any[] }>): void {
    if (!list || list.length === 0) return;
    const byId = new Map<string, { id: string; name: string; assignments: any[]; components: any[] }>();
    for (const existing of this.rawSubjects) {
      byId.set(existing.id, { ...existing, components: existing.components || [] });
    }
    for (const s of list) {
      if (!s.id || !s.name) continue;
      byId.set(s.id, {
        id: s.id,
        name: s.name,
        assignments: s.assignments || [],
        components: s.components || [],
      });
    }
    this.rawSubjects = Array.from(byId.values());
    this.rebuildSubjectOptionLabels();
  }

  /**
   * Derive {@link formSubjectOptions} from {@link rawSubjects} +
   * {@link classes}. When two subject docs share a name, suffix each
   * label with its assigned class names so the dropdown reads
   * "Sanskrit (1st)" vs "Sanskrit (1st, 2nd)" instead of two
   * indistinguishable "Sanskrit" rows.
   *
   * Safe to call before classes load — falls back to plain names until
   * the class lookup is ready, then the next call re-applies suffixes.
   */
  private rebuildSubjectOptionLabels(): void {
    if (!this.rawSubjects.length) { this.formSubjectOptions = []; return; }
    const nameCounts = new Map<string, number>();
    for (const entry of this.rawSubjects) {
      const key = entry.name.trim().toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }
    this.formSubjectOptions = this.rawSubjects
      .map((entry) => {
        const key = entry.name.trim().toLowerCase();
        if ((nameCounts.get(key) || 0) < 2) {
          return { id: entry.id, name: entry.name };
        }
        // Duplicate name — show BOTH the component shape (the functional
        // difference between two same-named subjects) AND the class list
        // (where each one applies). Admin should never have to guess
        // which "Sanskrit" they're picking.
        //   Sanskrit · Theory 100 · 1st, 2nd
        //   Sanskrit · Theory 80 + IA 20 · 2nd
        const compSummary = this.summariseComponents(entry.components || []);
        const classNames = (entry.assignments || [])
          .map((a: any) => this.classes.find((c) => c.classId === a.classId)?.name)
          .filter((n: any): n is string => !!n);
        const parts = [entry.name];
        if (compSummary) parts.push(compSummary);
        if (classNames.length > 0) parts.push(classNames.join(', '));
        return { id: entry.id, name: parts.join(' · ') };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Compact human-readable shape of a subject's components, used to
   * differentiate same-named subjects in the dropdown. Examples:
   *   [Theory 100]                     → "Theory 100"
   *   [Theory 80, IA 20]               → "Theory 80 + IA 20"
   *   [Theory 70, Practical 30]        → "Theory 70 + Practical 30"
   *   []                               → "" (caller skips the suffix)
   */
  private summariseComponents(comps: any[]): string {
    if (!comps || comps.length === 0) return '';
    return comps
      .map((c: any) => {
        const label = c?.label || c?.key || '?';
        const max = c?.maxMarks;
        return (typeof max === 'number') ? `${label} ${max}` : label;
      })
      .join(' + ');
  }

  onFilterClassChange(): void {
    this.filterSectionId = '';
    this.recomputeFilterSectionOptions();
    this.applyFilters();
  }

  onFilterSectionChange(): void { this.applyFilters(); }
  onFilterTeacherChange(): void { this.applyFilters(); }

  onSearchChange(): void {
    this.dataSource.filter = (this.searchQuery || '').trim().toLowerCase();
  }

  private applyFilters(): void {
    let list = this.allAssignments;
    if (this.filterClassId) list = list.filter(a => a.classId === this.filterClassId);
    if (this.filterSectionId) list = list.filter(a => a.sectionId === this.filterSectionId);
    if (this.filterTeacherId) list = list.filter(a => a.teacherId === this.filterTeacherId);
    this.dataSource.data = list;
    this.dataSource.filter = (this.searchQuery || '').trim().toLowerCase();
  }

  /** Strict filter: only classes that belong to the selected academic year.
   *  If none exist for that year, the dropdown stays empty (no fallback). */
  private recomputeFilterClassOptions(): void {
    if (!this.selectedAcademicYearId) {
      this.filterClassOptions = [];
      return;
    }
    this.filterClassOptions = this.classes.filter(
      (c: any) => c.academicYearId === this.selectedAcademicYearId,
    );
  }

  private recomputeFilterSectionOptions(): void {
    const cls = this.classes.find(c => c.classId === this.filterClassId);
    if (!cls || !cls.sections) { this.filterSectionOptions = []; return; }
    this.filterSectionOptions = cls.sections.map((s: any) => ({
      sectionId: s.sectionId,
      name: s.name,
      subjectIds: s.subjectIds,
    }));
  }

  clearFilters(): void {
    this.filterClassId = '';
    this.filterSectionId = '';
    this.filterTeacherId = '';
    this.searchQuery = '';
    this.filterSectionOptions = [];
    this.applyFilters();
  }

  // ── Form ───────────────────────────────────────────────────────────

  openCreateForm(): void {
    if (this.noClassesForYear) {
      this.snackBar.open(
        'No classes exist for this academic year. Create classes first from the Classes page.',
        'Close', { duration: 4000 });
      return;
    }
    this.editingId = null;
    this.formTeacherId = '';
    this.formClassIds = [];
    this.formSectionIds = [];
    this.formClassSectionKeys = [];
    this.formClassSectionOptions = [];
    this.classSectionSearch = '';
    this.subjectSearch = '';
    this.formClassId = '';
    this.formSectionId = '';
    this.formSubjectId = '';
    this.formComponentKey = null;
    this.formComponentKeys = [];
    this.formComponentChoices = [];
    this.formRoleClass = false;
    this.formRoleSubject = true;
    this.classTeacherClassId = '';
    this.classTeacherSectionId = '';
    this.classTeacherSectionOptions = [];
    this.recomputeFormClassOptions();
    // Build the (class × section) list for the whole AY right away — no
    // dependency on first picking classes, since the classes dropdown is gone.
    this.recomputeFormSectionOptions();
    this.formSectionOptions = [];
    // DO NOT wipe formSubjectOptions here — it's populated by the
    // SubjectService subscription + direct fetch in ngOnInit. Clearing it
    // would leave the dropdown empty every time the admin opens the form.
    // Re-fetch fresh so newly-added Subjects page entries appear.
    this.loadSubjectsDirect();
    this.formOpen = true;
  }

  openEditForm(a: TeacherSubjectAssignment): void {
    this.editingId = a.assignmentId;
    this.formTeacherId = a.teacherId;
    // In edit mode we stick to single-value. Mirror to the array fields
    // so templates that read the multi-select still see the same value.
    this.formClassId = a.classId;
    this.formClassIds = a.classId ? [a.classId] : [];
    this.formSectionId = a.sectionId || '';
    this.formSectionIds = a.sectionId ? [a.sectionId] : [];
    this.formSubjectId = a.subjectId || '';
    this.formComponentKey = a.componentKey || null;
    this.formComponentKeys = a.componentKey ? [a.componentKey] : [];
    // Repopulate the picker so the edit form shows the right options.
    this.refreshFormComponentChoices();
    this.formRoleClass = (a.roles || []).includes('CLASS_TEACHER');
    this.formRoleSubject = (a.roles || []).includes('SUBJECT_TEACHER');
    // When editing a Class Teacher row, pre-fill the class-teacher pickers.
    this.classTeacherClassId = this.formRoleClass ? a.classId : '';
    this.classTeacherSectionId = this.formRoleClass ? (a.sectionId || '') : '';
    this.recomputeFormClassOptions();
    this.recomputeFormSectionOptions();
    this.recomputeFormSubjectOptions();
    this.recomputeClassTeacherSectionOptions();
    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
  }

  // ── Create-mode (multi) handlers ────────────────────────────────

  onFormClassesChange(): void {
    this.recomputeFormSectionOptions();
    this.refreshFormSectionIdsFromKeys();
    this.formSubjectId = '';
    this.recomputeFormSubjectOptions();
  }

  /** Fires when the admin ticks/unticks a class×section pair in create mode.
   *  Derives `formClassIds` and `formSectionIds` so subject narrowing still
   *  works off the keys the admin actually picked. */
  onFormClassSectionsChange(): void {
    const classIds = new Set<string>();
    const sectionIds = new Set<string>();
    for (const key of this.formClassSectionKeys) {
      const [cId, sId] = key.split('::');
      if (cId) classIds.add(cId);
      if (sId) sectionIds.add(sId);
    }
    this.formClassIds = Array.from(classIds);
    this.formSectionIds = Array.from(sectionIds);
    // Subject is picked FIRST in the new flow — do NOT clear it here.
  }

  onFormSectionsChange(): void {
    this.formSubjectId = '';
    this.recomputeFormSubjectOptions();
  }

  // ── Edit-mode (single) handlers ────────────────────────────────

  onFormClassChange(): void {
    this.formSectionId = '';
    this.formSubjectId = '';
    this.recomputeFormSectionOptions();
    this.recomputeFormSubjectOptions();
  }

  onFormSectionChange(): void {
    this.formSubjectId = '';
    this.recomputeFormSubjectOptions();
  }

  // ── Class-Teacher-role picker handlers ─────────────────────────

  onClassTeacherClassChange(): void {
    // Section must belong to the newly-picked class.
    this.classTeacherSectionId = '';
    this.recomputeClassTeacherSectionOptions();
  }

  /** Returns the existing class-teacher assignment that conflicts with the
   *  currently-picked (class, section), or null if the slot is free.
   *
   *  Used by the template to warn the admin BEFORE they hit Save — the
   *  backend rejects this case too (single-class-teacher rule), but a
   *  pre-check is friendlier than a snackbar after a failed save.
   *  A conflict only exists if a DIFFERENT teacher already holds the role
   *  for the exact same class + section + year. */
  get existingClassTeacherForSlot(): TeacherSubjectAssignment | null {
    if (!this.formRoleClass) return null;
    if (!this.classTeacherClassId || !this.classTeacherSectionId) return null;
    if (!this.selectedAcademicYearId) return null;
    for (const a of this.allAssignments) {
      if (a.academicYearId !== this.selectedAcademicYearId) continue;
      if (a.classId !== this.classTeacherClassId) continue;
      if ((a.sectionId || '') !== this.classTeacherSectionId) continue;
      if (!(a.roles || []).includes('CLASS_TEACHER')) continue;
      // Same teacher? Not a conflict — backend will merge.
      if (a.teacherId === this.formTeacherId) continue;
      return a;
    }
    return null;
  }

  /** Pretty name of the teacher already assigned to the conflict slot,
   *  for display in the warning banner. */
  get existingClassTeacherName(): string {
    const a = this.existingClassTeacherForSlot;
    return a ? this.teacherName(a.teacherId) : '';
  }

  private recomputeClassTeacherSectionOptions(): void {
    if (!this.classTeacherClassId) { this.classTeacherSectionOptions = []; return; }
    const cls = this.classes.find(c => c.classId === this.classTeacherClassId);
    if (!cls || !cls.sections) { this.classTeacherSectionOptions = []; return; }
    this.classTeacherSectionOptions = cls.sections.map((s: any) => ({
      sectionId: s.sectionId,
      name: s.name,
      subjectIds: s.subjectIds,
    }));
  }

  /** Strict filter: only classes created for the selected academic year. */
  private recomputeFormClassOptions(): void {
    if (!this.selectedAcademicYearId) {
      this.formClassOptions = [];
      return;
    }
    this.formClassOptions = this.classes.filter(
      (c: any) => c.academicYearId === this.selectedAcademicYearId,
    );
  }

  /** Build the searchable (class × section) list + the subject catalog.
   *  Edit mode → single class's sections (for the legacy Section dropdown).
   *  Create mode → every section of every class in the selected AY, plus
   *    the subject-to-pair index used for filtering. */
  private recomputeFormSectionOptions(): void {
    if (this.editingId) {
      // Edit mode retains the original simple list.
      const cls = this.classes.find(c => c.classId === this.formClassId);
      if (!cls || !cls.sections) {
        this.formSectionOptions = [];
        this.formClassSectionOptions = [];
        return;
      }
      this.formSectionOptions = (cls.sections as any[]).map(s => ({
        sectionId: s.sectionId, name: s.name, subjectIds: s.subjectIds,
      }));
      this.formClassSectionOptions = [];
      return;
    }

    // Create mode — one row per (class, section) pair across the whole year.
    type Pair = {
      key: string; classId: string; sectionId: string;
      classLabel: string; sectionLabel: string; label: string; search: string;
    };
    const pairs: Pair[] = [];

    // Build the pair grid from classes + their sections.
    for (const cls of this.formClassOptions) {
      if (!cls.sections) continue;
      for (const sec of cls.sections as any[]) {
        if (!sec.sectionId) continue;
        const clsName = cls.name || '';
        const secName = sec.name || '';
        const label = `${clsName} — ${secName}`;
        const key = `${cls.classId}::${sec.sectionId}`;
        const search = [
          clsName, secName,
          `${clsName}${secName}`,
          `${clsName} ${secName}`,
          `${secName} ${clsName}`,
          label,
        ].join(' ').toLowerCase();
        pairs.push({
          key, classId: cls.classId, sectionId: sec.sectionId,
          classLabel: clsName, sectionLabel: secName, label, search,
        });
      }
    }

    // ── Subject → pair-key index, merging BOTH sources ────────────
    const subjectIndex = new Map<string, Set<string>>();

    // Source 1: canonical Subject rows from the Subjects module.
    //   Each row IS a (class, subject) record. Every section of that class
    //   is treated as offering the subject.
    const classIdToPairKeys = new Map<string, string[]>();
    for (const p of pairs) {
      if (!classIdToPairKeys.has(p.classId)) classIdToPairKeys.set(p.classId, []);
      classIdToPairKeys.get(p.classId)!.push(p.key);
    }
    for (const subj of this.allSubjectsForYear) {
      const sid = subj.subjectId || subj.id;
      if (!sid || !subj.classId) continue;
      const classPairKeys = classIdToPairKeys.get(subj.classId) || [];
      if (classPairKeys.length === 0) continue;
      if (!subjectIndex.has(sid)) subjectIndex.set(sid, new Set());
      const bucket = subjectIndex.get(sid)!;
      for (const k of classPairKeys) bucket.add(k);
    }

    // Source 2: section.subjectIds (legacy inline config on SchoolClass).
    for (const cls of this.formClassOptions) {
      if (!cls.sections) continue;
      for (const sec of cls.sections as any[]) {
        if (!sec.sectionId) continue;
        const key = `${cls.classId}::${sec.sectionId}`;
        for (const subjectId of (sec.subjectIds || [])) {
          if (!subjectIndex.has(subjectId)) subjectIndex.set(subjectId, new Set());
          subjectIndex.get(subjectId)!.add(key);
        }
      }
    }

    // Natural-number sort: "2 — A" before "10 — A".
    pairs.sort((a, b) => {
      const byClass = a.classLabel.localeCompare(b.classLabel, undefined, { numeric: true, sensitivity: 'base' });
      if (byClass !== 0) return byClass;
      return a.sectionLabel.localeCompare(b.sectionLabel, undefined, { numeric: true, sensitivity: 'base' });
    });
    this.formClassSectionOptions = pairs;
    this.subjectToPairKeys = subjectIndex;

    // Keep only previously-selected keys that still exist.
    const valid = new Set(pairs.map(p => p.key));
    this.formClassSectionKeys = this.formClassSectionKeys.filter(k => valid.has(k));
    this.formSectionOptions = [];

    // Subject dropdown options are populated separately by the
    // SubjectService subscription in ngOnInit — no need to rebuild here.
  }

  /** Free-text-filtered Subject dropdown options. */
  get visibleSubjectOptions() {
    const q = (this.subjectSearch || '').trim().toLowerCase();
    if (!q) return this.formSubjectOptions;
    return this.formSubjectOptions.filter(s => s.name.toLowerCase().includes(q));
  }

  /** Filtered view of the class-section dropdown:
   *   1. narrow to pairs that teach the currently-selected subject (if any),
   *   2. then apply the free-text search. */
  get visibleClassSectionOptions() {
    let pairs = this.formClassSectionOptions;
    if (this.formSubjectId) {
      const allowed = this.subjectToPairKeys.get(this.formSubjectId) || new Set<string>();
      pairs = pairs.filter(p => allowed.has(p.key));
    }
    const q = (this.classSectionSearch || '').trim().toLowerCase();
    if (!q) return pairs;
    return pairs.filter(p => p.search.includes(q));
  }

  labelForKey(key: string): string {
    const hit = this.formClassSectionOptions.find(p => p.key === key);
    if (hit) return hit.label;
    // Fallback: resolve from raw classes (in case options haven't rebuilt yet).
    const [classId, sectionId] = key.split('::');
    const cls = this.classes.find(c => c.classId === classId);
    const sec = (cls?.sections || []).find((s: any) => s.sectionId === sectionId);
    return cls ? `${cls.name}${(sec as any)?.name ? ' — ' + (sec as any).name : ''}` : key;
  }

  /** Toggle a pair's selection — used by chip removal + keyboard handlers. */
  toggleKey(key: string): void {
    const i = this.formClassSectionKeys.indexOf(key);
    if (i === -1) this.formClassSectionKeys = [...this.formClassSectionKeys, key];
    else this.formClassSectionKeys = this.formClassSectionKeys.filter(k => k !== key);
    this.onFormClassSectionsChange();
  }

  /** Recompute section-id list from the currently-selected class×section keys. */
  private refreshFormSectionIdsFromKeys(): void {
    const ids = new Set<string>();
    for (const key of this.formClassSectionKeys) {
      const parts = key.split('::');
      if (parts.length === 2 && parts[1]) ids.add(parts[1]);
    }
    this.formSectionIds = Array.from(ids);
  }

  /** Edit mode: leave the Subject dropdown showing the full catalog
   *  populated by the SubjectService subscription. Don't narrow by
   *  class/section here — that caused blank dropdowns when the inline
   *  section.subjectIds wasn't configured. */
  private recomputeFormSubjectOptions(): void {
    // No-op: formSubjectOptions is owned by the SubjectService-driven path.
  }

  /** Create mode: when the admin changes the Subject, prune any previously-
   *  picked pair that doesn't teach the new subject. */
  onFormSubjectChange(): void {
    if (this.editingId) return;
    // Refresh component choices regardless of whether the subject is set —
    // clearing the subject also clears the component selection.
    this.refreshFormComponentChoices();
    if (!this.formSubjectId) return; // showing all pairs
    const allowed = this.subjectToPairKeys.get(this.formSubjectId) || new Set<string>();
    this.formClassSectionKeys = this.formClassSectionKeys.filter(k => allowed.has(k));
    // Keep the derived arrays in sync for the save loop.
    const classIds = new Set<string>();
    const sectionIds = new Set<string>();
    for (const key of this.formClassSectionKeys) {
      const [cId, sId] = key.split('::');
      if (cId) classIds.add(cId);
      if (sId) sectionIds.add(sId);
    }
    this.formClassIds = Array.from(classIds);
    this.formSectionIds = Array.from(sectionIds);
  }

  /**
   * Repopulate {@link formComponentChoices} from the chosen subject's
   * component list. The picker is shown when there are 2+ components;
   * with 1 or 0 components we hide it and leave componentKey null so
   * the backend auto-fills.
   */
  private refreshFormComponentChoices(): void {
    this.formComponentKey = null;
    this.formComponentKeys = [];
    this.formComponentChoices = [];
    if (!this.formSubjectId) return;
    this.subjectService.getSubjectsByIds([this.formSubjectId]).subscribe(subs => {
      const sub = subs[0];
      const comps = sub?.components ?? [];
      if (comps.length > 1) {
        this.formComponentChoices = comps.map(c => ({ key: c.key, label: c.label }));
        // Create-mode default: pre-select every component so the common
        // case ("this teacher owns Math entirely — both Theory and IA")
        // is one click. The admin can untick if they really want a slice.
        if (!this.editingId) {
          this.formComponentKeys = comps.map(c => c.key);
        }
      }
    });
  }

  saveForm(): void {
    if (!this.formTeacherId || !this.selectedAcademicYearId) {
      this.snackBar.open('Select teacher and academic year.', 'Close', { duration: 2500 });
      return;
    }
    if (this.formRoleSubject === false && this.formRoleClass === false) {
      this.snackBar.open('Pick at least one role.', 'Close', { duration: 2500 });
      return;
    }

    // ── Edit mode: single row, single class + section ─────────────
    if (this.editingId) {
      if (!this.formClassId) {
        this.snackBar.open('Select a class.', 'Close', { duration: 2500 });
        return;
      }
      if (this.formRoleSubject && !this.formSubjectId) {
        this.snackBar.open('Subject Teacher role needs a subject.', 'Close', { duration: 2500 });
        return;
      }
      const roles: TeacherAssignmentRole[] = [];
      if (this.formRoleClass) roles.push('CLASS_TEACHER');
      if (this.formRoleSubject) roles.push('SUBJECT_TEACHER');
      const req: CreateTeacherAssignmentRequest = {
        teacherId: this.formTeacherId,
        academicYearId: this.selectedAcademicYearId,
        classId: this.formClassId,
        sectionId: this.formSectionId || undefined,
        subjectId: this.formSubjectId || undefined,
        roles,
      };
      this.isSaving = true;
      this.api.updateTeacherAssignment(this.editingId, req).subscribe({
        next: () => {
          this.isSaving = false;
          this.snackBar.open('Assignment updated', 'Close', { duration: 2000 });
          this.closeForm();
          this.loadAssignments();
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open(err?.error?.message || 'Failed to save assignment', 'Close', { duration: 3000 });
        },
      });
      return;
    }

    // ── Create mode: multi-select → many assignments ──────────────
    if (this.formClassIds.length === 0) {
      this.snackBar.open('Select at least one class.', 'Close', { duration: 2500 });
      return;
    }
    if (this.formRoleSubject && !this.formSubjectId) {
      this.snackBar.open('Subject Teacher role needs a subject.', 'Close', { duration: 2500 });
      return;
    }
    // When Class Teacher is ticked, the admin MUST choose exactly one class + section
    // (a class teacher by definition owns a single section).
    if (this.formRoleClass) {
      if (!this.classTeacherClassId || !this.classTeacherSectionId) {
        this.snackBar.open('Pick the class and section for the Class Teacher role.', 'Close', { duration: 3000 });
        return;
      }
      // Pre-check the single-class-teacher rule. The backend enforces this too,
      // but blocking up front saves a round trip and gives a clearer hint.
      const conflict = this.existingClassTeacherForSlot;
      if (conflict) {
        const slotLabel = `${this.classLabel(conflict)} — Section ${this.sectionLabel(conflict)}`.trim();
        this.snackBar.open(
          `${slotLabel} already has ${this.teacherName(conflict.teacherId)} as Class Teacher. Remove that assignment first.`,
          'Close', { duration: 5000 });
        return;
      }
    }

    const requests: CreateTeacherAssignmentRequest[] = [];
    // Build one SUBJECT_TEACHER row per explicitly-picked (class × section × component).
    //
    // Component handling:
    //   • Single-component subject → picker is hidden, formComponentKeys is empty.
    //     We push ONE request with componentKey undefined; backend auto-fills.
    //   • Multi-component subject → admin pre-selects all components; they can
    //     untick to slice. Each ticked component fans out to its own row.
    if (this.formRoleSubject) {
      const componentKeys: Array<string | undefined> =
          this.formComponentKeys.length > 0
              ? this.formComponentKeys.slice()
              : [undefined];

      if (this.formClassSectionKeys.length > 0) {
        for (const key of this.formClassSectionKeys) {
          const [classId, sectionId] = key.split('::');
          if (!classId || !sectionId) continue;
          for (const componentKey of componentKeys) {
            requests.push({
              teacherId: this.formTeacherId,
              academicYearId: this.selectedAcademicYearId,
              classId,
              sectionId,
              subjectId: this.formSubjectId || undefined,
              componentKey,
              roles: ['SUBJECT_TEACHER'],
            });
          }
        }
      } else {
        // No section picked at all — apply to each class as "whole class".
        for (const classId of this.formClassIds) {
          for (const componentKey of componentKeys) {
            requests.push({
              teacherId: this.formTeacherId,
              academicYearId: this.selectedAcademicYearId,
              classId,
              sectionId: undefined,
              subjectId: this.formSubjectId || undefined,
              componentKey,
              roles: ['SUBJECT_TEACHER'],
            });
          }
        }
      }
    }
    // One CLASS_TEACHER row (single class + section), if requested.
    if (this.formRoleClass) {
      requests.push({
        teacherId: this.formTeacherId,
        academicYearId: this.selectedAcademicYearId,
        classId: this.classTeacherClassId,
        sectionId: this.classTeacherSectionId,
        subjectId: undefined,
        roles: ['CLASS_TEACHER'],
      });
    }

    if (requests.length === 0) {
      this.snackBar.open('Nothing to save — check class/section selections.', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    let completed = 0;
    let successCount = 0;
    const errors: string[] = [];
    requests.forEach(req => {
      this.api.createTeacherAssignment(req).subscribe({
        next: () => {
          successCount++;
          this.maybeFinishSave(++completed, requests.length, successCount, errors);
        },
        error: (err) => {
          errors.push(err?.error?.message || 'Save failed');
          this.maybeFinishSave(++completed, requests.length, successCount, errors);
        },
      });
    });
  }

  private maybeFinishSave(completed: number, total: number, successCount: number, errors: string[]): void {
    if (completed < total) return;
    this.isSaving = false;
    if (errors.length === 0) {
      this.snackBar.open(`Created ${successCount} assignment${successCount === 1 ? '' : 's'}`,
        'Close', { duration: 2500 });
    } else if (successCount > 0) {
      this.snackBar.open(
        `Created ${successCount}, ${errors.length} failed. ${errors[0]}`,
        'Close', { duration: 4000 });
    } else {
      this.snackBar.open(errors[0] || 'Failed to create assignments', 'Close', { duration: 3500 });
    }
    this.closeForm();
    this.loadAssignments();
  }

  // ── Delete ─────────────────────────────────────────────────────────

  confirmDelete(a: TeacherSubjectAssignment): void {
    this.deleteTarget = a;
    this.deleteDialogOpen = true;
  }
  cancelDelete(): void { this.deleteDialogOpen = false; this.deleteTarget = null; }
  deleteAssignment(): void {
    if (!this.deleteTarget) return;
    this.isDeleting = true;
    const id = this.deleteTarget.assignmentId;
    this.api.deleteTeacherAssignment(id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.snackBar.open('Assignment removed', 'Close', { duration: 2000 });
        this.cancelDelete();
        this.loadAssignments();
      },
      error: (err) => {
        this.isDeleting = false;
        this.snackBar.open(err?.error?.message || 'Failed to delete', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Carry-forward ──────────────────────────────────────────────────

  openCarry(): void {
    this.carryFromYearId = '';
    this.carryToYearId = this.selectedAcademicYearId;
    this.carryOpen = true;
  }
  closeCarry(): void { this.carryOpen = false; }
  runCarry(): void {
    if (!this.carryFromYearId || !this.carryToYearId || this.carryFromYearId === this.carryToYearId) {
      this.snackBar.open('Pick two different academic years.', 'Close', { duration: 2500 });
      return;
    }

    // ── Client-side pre-check ─────────────────────────────────────────
    // Warn early if the target year has no classes — the backend will reject
    // it too, but a clear message before the call saves a round trip.
    const toYearClassCount = this.classes.filter(
      (c: any) => c.academicYearId === this.carryToYearId,
    ).length;
    if (toYearClassCount === 0) {
      const toLabel = this.academicYears.find(y => y.academicYearId === this.carryToYearId)?.label
        || 'the target year';
      this.snackBar.open(
        `No classes exist in ${toLabel}. Create classes for that year first.`,
        'Close', { duration: 5000 });
      return;
    }

    this.isCarrying = true;
    this.api.carryForwardTeacherAssignments({
      fromAcademicYearId: this.carryFromYearId,
      toAcademicYearId: this.carryToYearId,
      skipExisting: true,
    }).subscribe({
      next: (res) => {
        this.isCarrying = false;
        this.closeCarry();
        this.showCarryResult(res.data);
        this.loadAssignments();
      },
      error: (err) => {
        this.isCarrying = false;
        this.snackBar.open(
          err?.error?.message || 'Carry-forward failed. Please try again.',
          'Close', { duration: 5000 });
      },
    });
  }

  /** Friendly breakdown of what happened during carry-forward. */
  private showCarryResult(r: any): void {
    if (!r) {
      this.snackBar.open('Carry-forward completed.', 'Close', { duration: 3000 });
      return;
    }
    const copied = r.copied ?? 0;
    const scanned = r.scanned ?? 0;
    const skippedDup = r.skippedDuplicate ?? 0;
    const skippedClass = r.skippedNoMatchingClass ?? 0;
    const skippedSection = r.skippedNoMatchingSection ?? 0;
    const skippedSubject = r.skippedNoMatchingSubject ?? 0;

    const bits: string[] = [`Copied ${copied} of ${scanned}`];
    if (skippedDup > 0) bits.push(`${skippedDup} already existed`);
    if (skippedClass > 0) bits.push(`${skippedClass} had no matching class`);
    if (skippedSection > 0) bits.push(`${skippedSection} had no matching section`);
    if (skippedSubject > 0) bits.push(`${skippedSubject} had no matching subject`);

    this.snackBar.open(bits.join(' · '), 'Close', {
      duration: copied === scanned ? 3500 : 6000,
    });
  }

  // ── Display helpers ────────────────────────────────────────────────

  teacherName(id: string): string {
    const t = this.teachers.find(x => x.teacherId === id);
    return t ? t.name : id;
  }

  classLabel(a: TeacherSubjectAssignment): string {
    const cls = this.classes.find(c => c.classId === a.classId);
    return cls ? cls.name : a.classId;
  }

  sectionLabel(a: TeacherSubjectAssignment): string {
    if (!a.sectionId) return '—';
    const cls = this.classes.find(c => c.classId === a.classId);
    if (!cls || !cls.sections) return '(deleted section)';
    const sec = (cls.sections as any[]).find(s => s.sectionId === a.sectionId);
    return sec ? sec.name : '(deleted section)';
  }

  subjectLabel(a: TeacherSubjectAssignment): string {
    if (!a.subjectId) return '—';
    return this.subjectService.getSubjectName(a.subjectId);
  }

  rolesLabel(roles: TeacherAssignmentRole[] = []): string[] {
    return (roles || []).map(r => r === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher');
  }
}
