import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
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
import { ApiService, BulkCreateExamRequest, BulkCreateExamSubjectConfig, BulkCreateExamComponentConfig } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

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

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
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

    this.api.getExamTypes().subscribe({
      next: (res) => { this.examTypes = res?.data || []; },
    });

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
        const current = this.academicYears.find((y) => y.current);
        if (current) {
          this.form.patchValue({ academicYearId: current.academicYearId });
          this.loadClassesForYear(current.academicYearId);
        }
      },
    });
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
        opts.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) ||
                              a.sectionName.localeCompare(b.sectionName, undefined, { numeric: true }));
        this.pairOptions = opts;
      },
    });
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

  /** Refresh the subject pool whenever the pair selection changes. */
  private refreshAvailableSubjects(): void {
    // Bump the token first so any in-flight subscribe callback from a prior
    // call drops its response on arrival (race fix — see token doc above).
    const myToken = ++this.subjectsFetchToken;

    if (this.pickedPairKeys.size === 0) {
      this.availableSubjects = [];
      // Prune picked rows that no longer have a backing pair.
      this.pickedSubjectRows = [];
      return;
    }
    const subjectIds = new Set<string>();
    for (const key of this.pickedPairKeys) {
      const [classId, sectionId] = key.split('::');
      const cls = this.classes.find(c => c.classId === classId);
      const sec = cls?.sections?.find(s => s.sectionId === sectionId);
      (sec?.subjectIds || []).forEach(id => subjectIds.add(id));
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
          // Sort alphabetically — admin picks from a long list, deterministic order helps.
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        // Drop picked rows whose subject is no longer in the pool.
        const avail = new Set(this.availableSubjects.map(s => s.subjectId));
        this.pickedSubjectRows = this.pickedSubjectRows.filter(r => avail.has(r.subjectId));
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
    this.api.bulkCreateExams(payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        const out = res?.data;
        const created = out?.created ?? 0;
        const dup = out?.skippedDuplicate ?? 0;
        const skip = out?.skippedNotConfigured ?? 0;
        let msg = `Created ${created} exam${created === 1 ? '' : 's'}`;
        if (dup > 0) msg += ` · ${dup} duplicate${dup === 1 ? '' : 's'} skipped`;
        if (skip > 0) msg += ` · ${skip} combination${skip === 1 ? '' : 's'} not configured`;
        this.snackBar.open(msg, 'Close', { duration: 5000 });
        // Stay on the page so admin can configure another exam type
        // without re-picking everything. Clear only the pickedSubjectRows
        // and reset Date — the year + pairs persist.
        this.pickedSubjectRows = [];
        this.form.patchValue({ examType: '', examDate: null, startTime: '', endTime: '', description: '' });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to create exams.',
          'Close', { duration: 4000 });
      },
    });
  }

  goToExams(): void {
    this.router.navigate(['/exams']);
  }
}
