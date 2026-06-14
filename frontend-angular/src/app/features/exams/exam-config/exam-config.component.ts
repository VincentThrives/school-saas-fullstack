import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { compareClassNames } from '../../../shared/utils/class-sort';
import { ApiService, BulkCreateExamRequest, BulkCreateExamSubjectConfig, BulkCreateExamComponentConfig, ExamConfigDetail } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear } from '../../../core/models';
import { forkJoin } from 'rxjs';

/** One (classId, sectionId) pair rendered as a checkbox in the pair grid. */
interface PairOption {
  key: string;            // `${classId}::${sectionId}`
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
}

/**
 * One picked subject. Carries:
 * - subjectId / subjectName for display
 * - the subject's EXAM-eligible components (resolved when subject is picked)
 * - the per-component max/pass the admin enters in this form
 * - combined toggle (only meaningful when ≥2 components)
 */
interface SubjectRow {
  subjectId: string;
  subjectName: string;
  /**
   * Whether the bulk endpoint should create ONE exam doc with multiple
   * components inside (mark entry shows columns) or N exam docs
   * (separate rows). Forced to false for single-component subjects.
   */
  combined: boolean;
  hasMultipleComponents: boolean;
  components: SubjectComponentRow[];
}

interface SubjectComponentRow {
  key: string;
  label: string;
  assessmentMode: 'EXAM' | 'INTERNAL';
  maxMarks: number | null;
  passingMarks: number | null;
}

@Component({
  selector: 'app-exam-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './exam-config.component.html',
  styleUrl: './exam-config.component.scss',
  providers: [provideNativeDateAdapter()],
})
export class ExamConfigComponent implements OnInit {
  form!: FormGroup;
  examTypes: any[] = [];
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  pairOptions: PairOption[] = [];
  pickedPairKeys = new Set<string>();
  /**
   * Subjects taught in the picked pairs. Recomputed whenever pair selection
   * changes — we union the subjectIds across selected sections so a teacher
   * picking 1-A and 2-B sees every subject covering at least one of them.
   */
  availableSubjects: SubjectItem[] = [];
  pickedSubjectRows: SubjectRow[] = [];
  isSaving = false;
  isLoading = false;
  /**
   * Token bumped on every refreshAvailableSubjects() call. The subscribe
   * callback ignores its own response if the token has moved on — without
   * this, a stale wider-set response can land after a newer narrower one
   * and re-show class subjects the admin just deselected.
   */
  private subjectsFetchToken = 0;

  /** Edit-mode state: when set, save deletes the original config and recreates. */
  editMode = false;
  editingExamType: string | null = null;
  editingAcademicYearId: string | null = null;
  /** Pending detail from the backend — applied after classes + subjects load. */
  private pendingDetail: ExamConfigDetail | null = null;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      examType: ['', Validators.required],
      academicYearId: ['', Validators.required],
      examDate: [null],
      startTime: [''],
      endTime: [''],
      description: [''],
    });

    // Edit mode? URL param :examType + ?academicYearId query.
    const typeParam = this.route.snapshot.paramMap.get('examType');
    const yearParam = this.route.snapshot.queryParamMap.get('academicYearId');
    if (typeParam && yearParam) {
      this.editMode = true;
      this.editingExamType = decodeURIComponent(typeParam);
      this.editingAcademicYearId = yearParam;
    }

    this.api.getExamTypes().subscribe({
      next: (res) => { this.examTypes = res?.data || []; },
    });

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];

        if (this.editMode && this.editingAcademicYearId) {
          // Year pre-selected from URL; load the config detail then the
          // pair grid + subjects.
          this.form.patchValue({ academicYearId: this.editingAcademicYearId });
          this.loadConfigDetail();
        } else {
          const current = this.academicYears.find((y) => y.current);
          if (current) {
            this.form.patchValue({ academicYearId: current.academicYearId });
            this.loadClassesForYear(current.academicYearId);
          }
        }
      },
    });
  }

  /**
   * Fetch the existing config + classes; apply the pre-fill once both are
   * loaded so the pair grid actually has entries to tick.
   */
  private loadConfigDetail(): void {
    if (!this.editingAcademicYearId || !this.editingExamType) return;
    this.isLoading = true;
    forkJoin({
      detail: this.api.getExamConfigDetail(this.editingAcademicYearId, this.editingExamType),
      classes: this.api.getClasses(this.editingAcademicYearId),
    }).subscribe({
      next: (res) => {
        // Classes ready first — populate the pair grid before applying ticks.
        this.classes = Array.isArray(res.classes.data) ? res.classes.data : [];
        this.buildPairOptions();
        // Then apply the saved detail.
        this.pendingDetail = res.detail?.data || null;
        this.applyPendingDetail();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load config for editing.', 'Close', { duration: 4000 });
      },
    });
  }

  /**
   * Apply the pre-fill detail: tick the (class, section) checkboxes and
   * pre-populate picked subject rows with the saved max/pass values.
   */
  private applyPendingDetail(): void {
    const d = this.pendingDetail;
    if (!d) return;
    this.form.patchValue({
      examType: d.examType,
      academicYearId: d.academicYearId,
      examDate: d.examDate ? new Date(d.examDate) : null,
      startTime: d.startTime || '',
      endTime: d.endTime || '',
      description: d.description || '',
    });
    this.pickedPairKeys = new Set(
      (d.pairs || []).map(p => `${p.classId}::${p.sectionId}`)
    );
    // Subjects need a service round-trip to resolve names + components.
    this.refreshAvailableSubjects(d.subjectConfigs);
  }

  onAcademicYearChange(): void {
    const yearId = this.form.get('academicYearId')?.value;
    this.classes = [];
    this.pairOptions = [];
    this.pickedPairKeys.clear();
    this.availableSubjects = [];
    this.pickedSubjectRows = [];
    if (yearId) {
      this.loadClassesForYear(yearId);
    }
  }

  private loadClassesForYear(yearId: string): void {
    this.api.getClasses(yearId).subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        this.buildPairOptions();
      },
    });
  }

  /** Flatten `this.classes` into the pair-grid options used by the form. */
  private buildPairOptions(): void {
    const opts: PairOption[] = [];
    for (const cls of this.classes) {
      for (const sec of (cls.sections || [])) {
        opts.push({
          key: `${cls.classId}::${sec.sectionId}`,
          classId: cls.classId,
          sectionId: sec.sectionId,
          className: cls.name,
          sectionName: sec.name,
        });
      }
    }
    // Sort by class first (canonical Indian-school order: LKG/UKG
    // before 1st-12th — see {@link classSortKey}), section second.
    opts.sort((a, b) => compareClassNames(a.className, b.className)
                        || a.sectionName.localeCompare(b.sectionName, undefined, { numeric: true }));
    this.pairOptions = opts;
  }

  // ── Pair selection ───────────────────────────────────────────────────

  togglePair(opt: PairOption, checked: boolean): void {
    if (checked) this.pickedPairKeys.add(opt.key);
    else this.pickedPairKeys.delete(opt.key);
    this.refreshAvailableSubjects();
  }

  pickAllPairsInClass(classId: string, checked: boolean): void {
    for (const opt of this.pairOptions) {
      if (opt.classId !== classId) continue;
      if (checked) this.pickedPairKeys.add(opt.key);
      else this.pickedPairKeys.delete(opt.key);
    }
    this.refreshAvailableSubjects();
  }

  isClassFullyPicked(classId: string): boolean {
    const inClass = this.pairOptions.filter(p => p.classId === classId);
    return inClass.length > 0 && inClass.every(p => this.pickedPairKeys.has(p.key));
  }

  /** True when some but not all sections of this class are picked. Drives
   *  the "indeterminate" tri-state on the class-level checkbox. */
  isClassPartiallyPicked(classId: string): boolean {
    const inClass = this.pairOptions.filter(p => p.classId === classId);
    const picked = inClass.filter(p => this.pickedPairKeys.has(p.key)).length;
    return picked > 0 && picked < inClass.length;
  }

  /** Group pair options by class for tidy rendering. */
  get pairOptionsByClass(): Array<{ classId: string; className: string; pairs: PairOption[] }> {
    const map = new Map<string, { classId: string; className: string; pairs: PairOption[] }>();
    for (const p of this.pairOptions) {
      if (!map.has(p.classId)) {
        map.set(p.classId, { classId: p.classId, className: p.className, pairs: [] });
      }
      map.get(p.classId)!.pairs.push(p);
    }
    return Array.from(map.values());
  }

  /**
   * Strict assignment-based check: does this Subject actually apply to
   * ANY of the currently-picked (class, section) pairs?
   *
   * <p>A subject covers a pair iff its {@code assignments} contains an
   * entry where:</p>
   * <ul>
   *   <li>{@code assignment.classId} == picked classId, AND</li>
   *   <li>{@code assignment.sectionIds} is empty (meaning "all
   *       sections of this class") OR contains the picked sectionId.</li>
   * </ul>
   *
   * <p>Legacy subjects with no {@code assignments} array are treated
   * as "everywhere" so they don't disappear from old configs. The
   * earlier filter relied on {@code section.subjectIds} alone, which
   * can be a stale superset: creating a Subject for a whole class
   * auto-attaches it to every section, so a section the admin later
   * configured with only Hindi would still see Mathematics until
   * this stricter check kicks in.</p>
   */
  private subjectCoversAnyPickedPair(s: SubjectItem): boolean {
    const assignments = s.assignments || [];
    if (assignments.length === 0) return true; // legacy / "everywhere" — don't hide
    for (const key of this.pickedPairKeys) {
      const [classId, sectionId] = key.split('::');
      for (const a of assignments) {
        if (a.classId !== classId) continue;
        const secIds = a.sectionIds || [];
        if (secIds.length === 0 || secIds.includes(sectionId)) return true;
      }
    }
    return false;
  }

  /**
   * Refresh the subject pool whenever the pair selection changes.
   *
   * @param preloadedSubjectConfigs optional — for edit mode, the saved
   *   subject configs the form should pre-populate once available
   *   subjects load. Replaces (not merges with) `pickedSubjectRows`.
   */
  private refreshAvailableSubjects(
    preloadedSubjectConfigs?: BulkCreateExamSubjectConfig[]
  ): void {
    // Bump the token first so any in-flight subscribe callback from a prior
    // call drops its response on arrival (race fix — see token doc above).
    const myToken = ++this.subjectsFetchToken;

    if (this.pickedPairKeys.size === 0) {
      this.availableSubjects = [];
      // Prune picked rows that no longer have a backing pair.
      this.pickedSubjectRows = [];
      return;
    }
    // Union of section subjectIds across picked pairs PLUS any subjects from
    // the preload (so an edit-mode load can resolve subject names even if
    // the section's subjectIds were edited later).
    const subjectIds = new Set<string>();
    for (const key of this.pickedPairKeys) {
      const [classId, sectionId] = key.split('::');
      const cls = this.classes.find(c => c.classId === classId);
      const sec = cls?.sections?.find(s => s.sectionId === sectionId);
      (sec?.subjectIds || []).forEach(id => subjectIds.add(id));
    }
    for (const cfg of (preloadedSubjectConfigs || [])) {
      if (cfg?.subjectId) subjectIds.add(cfg.subjectId);
    }
    if (subjectIds.size === 0) {
      this.availableSubjects = [];
      this.pickedSubjectRows = [];
      return;
    }
    this.subjectService.getSubjectsByIds(Array.from(subjectIds)).subscribe({
      next: (subs) => {
        // Drop stale response — only the latest fetch may mutate state.
        if (myToken !== this.subjectsFetchToken) return;
        this.availableSubjects = subs
          .filter(s => s.components && s.components.length > 0)
          // Cross-check against the Subject's OWN assignments. The
          // section.subjectIds list this method seeded from can be a
          // stale superset — a Subject created without a specific
          // section auto-fans out into every section's subjectIds, so
          // a class admin who later configures "only Hindi for 3rd-C"
          // still sees Mathematics here unless we re-check the
          // canonical assignment list. See subjectCoversAnyPickedPair
          // for the exact rule.
          .filter(s => this.subjectCoversAnyPickedPair(s))
          // Sort alphabetically — admin picks from a long list, deterministic order helps.
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (preloadedSubjectConfigs && preloadedSubjectConfigs.length > 0) {
          // Edit-mode pre-fill — build picked subject rows from saved config.
          this.pickedSubjectRows = preloadedSubjectConfigs
            .map(cfg => {
              const sub = this.availableSubjects.find(s => s.subjectId === cfg.subjectId)
                       ?? subs.find(s => s.subjectId === cfg.subjectId);
              if (!sub) return null;
              const hasMultiple = (cfg.components?.length ?? 0) > 1
                                || ((sub.components?.length ?? 0) > 1);
              return {
                subjectId: sub.subjectId,
                subjectName: sub.name,
                combined: !!cfg.combined,
                hasMultipleComponents: hasMultiple,
                components: (cfg.components || []).map(c => ({
                  key: c.key,
                  label: c.label,
                  // Look up the assessment mode from the subject (saved
                  // exam doc doesn't carry it).
                  assessmentMode: (sub.components?.find(sc => sc.key === c.key)?.assessmentMode
                                  || 'EXAM') as 'EXAM' | 'INTERNAL',
                  maxMarks: c.maxMarks ?? null,
                  passingMarks: c.passingMarks ?? null,
                })),
              } as SubjectRow;
            })
            .filter((r): r is SubjectRow => !!r);
        } else {
          // Drop picked rows whose subject is no longer in the pool.
          const avail = new Set(this.availableSubjects.map(s => s.subjectId));
          this.pickedSubjectRows = this.pickedSubjectRows.filter(r => avail.has(r.subjectId));
        }
      },
    });
  }

  isSubjectPicked(subjectId: string): boolean {
    return this.pickedSubjectRows.some(r => r.subjectId === subjectId);
  }

  toggleSubject(subject: SubjectItem, checked: boolean): void {
    if (checked) {
      if (this.isSubjectPicked(subject.subjectId)) return;
      const comps = (subject.components || []).map(c => ({
        key: c.key,
        label: c.label,
        assessmentMode: c.assessmentMode,
        // Pre-fill from subject if present (legacy convenience) — admin can
        // override per exam. Schools running UT1 at 40+10 just type fresh.
        maxMarks: (c.maxMarks ?? null) as number | null,
        passingMarks: (c.passMarks ?? null) as number | null,
      } as SubjectComponentRow));
      const hasMultiple = comps.length > 1;
      this.pickedSubjectRows.push({
        subjectId: subject.subjectId,
        subjectName: subject.name,
        combined: hasMultiple,   // default Combined ON for multi-component subjects
        hasMultipleComponents: hasMultiple,
        components: comps,
      });
    } else {
      this.pickedSubjectRows = this.pickedSubjectRows.filter(r => r.subjectId !== subject.subjectId);
    }
  }

  removeSubjectRow(subjectId: string): void {
    this.pickedSubjectRows = this.pickedSubjectRows.filter(r => r.subjectId !== subjectId);
  }

  // ── Submit ───────────────────────────────────────────────────────────

  get isSubmitDisabled(): boolean {
    if (this.form.invalid) return true;
    if (this.pickedPairKeys.size === 0) return true;
    if (this.pickedSubjectRows.length === 0) return true;
    // Every component row must have valid max/pass.
    for (const row of this.pickedSubjectRows) {
      for (const c of row.components) {
        const max = Number(c.maxMarks);
        const pass = Number(c.passingMarks);
        if (!isFinite(max) || max <= 0) return true;
        if (!isFinite(pass) || pass < 0 || pass > max) return true;
      }
    }
    return this.isSaving;
  }

  submit(): void {
    if (this.isSubmitDisabled) {
      this.snackBar.open(
        'Fill in exam type, pick at least one pair + subject, and enter valid max/pass marks.',
        'Close', { duration: 4000 });
      return;
    }

    const formVal = this.form.value;
    let examDate = formVal.examDate;
    if (examDate instanceof Date) {
      const y = examDate.getFullYear();
      const m = String(examDate.getMonth() + 1).padStart(2, '0');
      const d = String(examDate.getDate()).padStart(2, '0');
      examDate = `${y}-${m}-${d}`;
    }

    const pairs = Array.from(this.pickedPairKeys).map(k => {
      const [classId, sectionId] = k.split('::');
      return { classId, sectionId };
    });

    const subjectConfigs: BulkCreateExamSubjectConfig[] = this.pickedSubjectRows.map(r => ({
      subjectId: r.subjectId,
      combined: r.hasMultipleComponents && r.combined,
      components: r.components.map(c => ({
        key: c.key,
        label: c.label,
        maxMarks: Number(c.maxMarks),
        passingMarks: Number(c.passingMarks),
      } as BulkCreateExamComponentConfig)),
    }));

    const payload: BulkCreateExamRequest = {
      examType: formVal.examType,
      academicYearId: formVal.academicYearId,
      examDate: examDate || null,
      startTime: formVal.startTime || null,
      endTime: formVal.endTime || null,
      description: formVal.description || null,
      pairs,
      subjectConfigs,
    };

    this.isSaving = true;

    // Edit mode = delete + recreate so changes apply to a clean slate
    // (and any "edit will reset marks" warning the admin saw is honoured).
    if (this.editMode && this.editingExamType && this.editingAcademicYearId) {
      this.api.deleteExamConfig(this.editingAcademicYearId, this.editingExamType).subscribe({
        next: () => this.runBulkCreate(payload, true),
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open(
            err?.error?.message || 'Failed to delete the old config before editing.',
            'Close', { duration: 4000 });
        },
      });
      return;
    }

    this.runBulkCreate(payload, false);
  }

  /** Send the bulkCreate request and handle the response uniformly for
   *  both create and edit-save paths. */
  private runBulkCreate(payload: BulkCreateExamRequest, isEdit: boolean): void {
    this.api.bulkCreateExams(payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        const out = res?.data;
        const created = out?.created ?? 0;
        const dup = out?.skippedDuplicate ?? 0;
        const skip = out?.skippedNotConfigured ?? 0;
        let msg = isEdit
          ? `Updated config — ${created} exam${created === 1 ? '' : 's'} recreated`
          : `Created ${created} exam${created === 1 ? '' : 's'}`;
        if (dup > 0) msg += ` · ${dup} duplicate${dup === 1 ? '' : 's'} skipped`;
        if (skip > 0) msg += ` · ${skip} combination${skip === 1 ? '' : 's'} not configured`;
        this.snackBar.open(msg, 'Close', { duration: 5000 });

        // Back to the list view in both modes. The list is the "view"
        // page for exam configs — one row per [year, examType] tuple
        // showing what was just created. Earlier the create path stayed
        // on the form and silently wiped a few fields; admins expected
        // a navigation like every other "create" flow in the app and
        // wondered if the click had even registered.
        this.router.navigate(['/exams/config']);
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(
          err?.error?.message || (isEdit ? 'Failed to save edits.' : 'Failed to create exams.'),
          'Close', { duration: 4000 });
      },
    });
  }

  goToExams(): void {
    this.router.navigate(['/exams/config']);
  }

  get pageTitle(): string {
    return this.editMode ? 'Edit Exam Config' : 'Exam Config';
  }

  get pageSubtitle(): string {
    return this.editMode
      ? 'Saving will replace the existing exams in this config with the values below'
      : 'Create exams in bulk — one exam type across many classes & subjects in a single save';
  }

  get submitLabel(): string {
    if (this.isSaving) return this.editMode ? 'Saving…' : 'Creating…';
    return this.editMode ? 'Save Changes' : 'Create Exams';
  }
}
