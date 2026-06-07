import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatRadioModule } from '@angular/material/radio';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SubjectService, SubjectItem, SubjectComponent, CreateOrUpdateSubject } from '../../../core/services/subject.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-subjects-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatRadioModule,
    MatAutocompleteModule,
    PageHeaderComponent,
  ],
  templateUrl: './subjects-list.component.html',
  styleUrl: './subjects-list.component.scss',
})
export class SubjectsListComponent implements OnInit, AfterViewChecked, OnDestroy {
  /**
   * The dialog overlay element. We need a handle so we can move it to
   * {@code document.body} as soon as it's rendered — the dialog lives
   * inside {@code mat-sidenav-content}, whose {@code translate3d}
   * transform creates a containing block that traps {@code
   * position: fixed} children. Moving the overlay to body lets it
   * actually cover the viewport including the app header.
   */
  @ViewChild('dialogOverlay') dialogOverlay?: ElementRef<HTMLElement>;
  @ViewChild('deleteOverlay') deleteOverlay?: ElementRef<HTMLElement>;
  private movedCreateToBody = false;
  private movedDeleteToBody = false;
  // Renamed "type" column to "summary" — shows component count + makeup
  // so the same column works for legacy single-type subjects AND new
  // component-shaped subjects.
  displayedColumns: string[] = ['name', 'code', 'summary', 'actions'];
  dataSource = new MatTableDataSource<SubjectItem>([]);
  isLoading = false;

  createDialogOpen = false;
  isCreating = false;
  form!: FormGroup;

  classes: Array<{ classId: string; name: string; sections?: Array<{ sectionId: string; name: string }> }> = [];

  /** Sections of the currently-selected class — drives the "Apply to sections" picker. */
  sectionsForSelectedClass: Array<{ sectionId: string; name: string }> = [];
  academicYears: Array<{ academicYearId: string; label: string }> = [];

  // Delete dialog state
  deleteDialogOpen = false;
  selectedSubject: SubjectItem | null = null;

  constructor(
    private subjectService: SubjectService,
    private apiService: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
  ) {}

  ngAfterViewChecked(): void {
    // Hoist dialog overlays to <body> the first time they appear,
    // escaping mat-sidenav-content's transform context that traps
    // position:fixed children. *ngIf destroys the element on close,
    // so the body-attached copy goes with it.
    if (this.createDialogOpen && this.dialogOverlay && !this.movedCreateToBody) {
      document.body.appendChild(this.dialogOverlay.nativeElement);
      this.movedCreateToBody = true;
    } else if (!this.createDialogOpen) {
      this.movedCreateToBody = false;
    }
    if (this.deleteDialogOpen && this.deleteOverlay && !this.movedDeleteToBody) {
      document.body.appendChild(this.deleteOverlay.nativeElement);
      this.movedDeleteToBody = true;
    } else if (!this.deleteDialogOpen) {
      this.movedDeleteToBody = false;
    }
  }

  ngOnDestroy(): void {
    // If the component is torn down while a dialog was open, make
    // sure we don't leak the body-attached node.
    this.dialogOverlay?.nativeElement?.remove();
    this.deleteOverlay?.nativeElement?.remove();
  }

  ngOnInit(): void {
    this.loadSubjects();
    this.loadClassesAndYears();
    this.buildForm();
  }

  // ── Form construction ──────────────────────────────────────────────

  /**
   * Subject-type presets — these are what the admin actually picks
   * from the dropdown. Each preset declares the components that get
   * auto-created when the type is selected, so the admin never has
   * to think about the FormArray for the 95% case. Power users can
   * flip on "Customise components" to edit the array directly.
   */
  readonly subjectTypePresets: Array<{
    value: string;
    label: string;
    description: string;
    components: ReturnType<SubjectsListComponent['presetComponent']>[];
    suggestedPassRule: 'PER_COMPONENT' | 'COMBINED';
  }> = [
    {
      value: 'THEORY',
      label: 'Theory only',
      description: 'One paper. Most subjects in primary classes.',
      suggestedPassRule: 'PER_COMPONENT',
      components: [this.presetComponent('theory', 'Theory', 100, 35, true, 'EXAM')],
    },
    {
      value: 'PRACTICAL',
      label: 'Practical only',
      description: 'Lab / activity-based subject with attendance.',
      suggestedPassRule: 'PER_COMPONENT',
      components: [this.presetComponent('practical', 'Practical', 100, 35, true, 'EXAM')],
    },
    {
      value: 'THEORY_PRACTICAL',
      label: 'Theory + Practical (Hybrid)',
      description: 'PUC sciences, Computer Science — both with attendance.',
      suggestedPassRule: 'PER_COMPONENT',
      components: [
        this.presetComponent('theory',    'Theory',    70, 28, true, 'EXAM'),
        this.presetComponent('practical', 'Practical', 30, 12, true, 'EXAM'),
      ],
    },
    {
      value: 'THEORY_INTERNAL',
      label: 'Theory + Internal Assessment',
      description: '10th English / Hindi style. IA marks from assignments, no attendance.',
      suggestedPassRule: 'PER_COMPONENT',
      components: [
        this.presetComponent('theory',   'Theory',              80, 27, true,  'EXAM'),
        this.presetComponent('internal', 'Internal Assessment', 20, 7,  false, 'INTERNAL', 'PER_TERM'),
      ],
    },
    {
      value: 'CUSTOM',
      label: 'Custom (advanced)',
      description: 'Build the component list manually — projects, oral viva, etc.',
      suggestedPassRule: 'PER_COMPONENT',
      components: [this.presetComponent('theory', 'Theory', 100, 35, true, 'EXAM')],
    },
  ];

  /** Set true to expose the raw FormArray of components for editing. */
  customiseComponents = false;

  /**
   * Type-ahead suggestions for the Subject Name field. These are NOT
   * pre-loaded as actual subjects in the DB — they only seed the
   * autocomplete dropdown so admins typing common Indian-board
   * subjects get one-click selection. Anything the admin types that
   * isn't in this list is accepted verbatim.
   */
  readonly subjectNameSuggestions = [
    'Mathematics', 'English', 'Hindi', 'Kannada', 'Sanskrit', 'Tamil', 'Telugu',
    'Science', 'Physics', 'Chemistry', 'Biology', 'Social Studies', 'History',
    'Geography', 'Civics', 'Economics', 'Computer Science', 'Information Technology',
    'EVS', 'Physical Education', 'Art & Craft', 'Music', 'Moral Science',
    'General Knowledge', 'Yoga', 'Drawing',
  ];

  /** Filtered subset shown in the autocomplete panel as the admin types. */
  filteredNameSuggestions: string[] = [];

  /**
   * Recompute the autocomplete options based on current input.
   * Plain case-insensitive "starts-with OR contains" match, capped
   * to 8 hits so the panel stays compact.
   */
  filterNameSuggestions(): void {
    const v = (this.form?.get('name')?.value || '').toLowerCase().trim();
    if (!v) {
      this.filteredNameSuggestions = this.subjectNameSuggestions.slice(0, 8);
      return;
    }
    this.filteredNameSuggestions = this.subjectNameSuggestions
      .filter(s => s.toLowerCase().includes(v))
      .slice(0, 8);
  }

  /**
   * Build the reactive form. Starts with the THEORY preset selected so
   * the simplest case ("just a Theory subject") is one click — type
   * any name, pick class/year, hit Create.
   */
  private buildForm(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      classId: ['', Validators.required],
      academicYearId: ['', Validators.required],
      subjectType: ['THEORY', Validators.required],
      passRule: ['PER_COMPONENT', Validators.required],
      // Multi-select of section ids to push the subject into. The
      // backend treats an empty list as "all sections of the chosen
      // class" — so leaving this untouched still gives the common-case
      // behaviour. Wired via (selectionChange) and (ngModelChange) so
      // changing Class resets it.
      applyToSectionIds: [[] as string[]],
      components: this.fb.array([this.buildComponentGroup('theory', 'Theory', 100, 35, true, 'EXAM')]),
    });
    // Keep components array in sync whenever the admin picks a different preset.
    this.form.get('subjectType')?.valueChanges.subscribe(v => this.applyPreset(v));
    this.customiseComponents = false;
  }

  /** Lightweight description of a component used to seed presets. */
  private presetComponent(
    key: string, label: string, maxMarks: number, passMarks: number,
    trackAttendance: boolean, assessmentMode: 'EXAM' | 'INTERNAL',
    internalSchedule: 'PER_TERM' | 'PER_YEAR' = 'PER_TERM',
  ) {
    return { key, label, maxMarks, passMarks, trackAttendance, assessmentMode, internalSchedule };
  }

  /**
   * Rebuild the components FormArray from the selected preset. The
   * admin can still flip on "Customise components" afterwards to edit
   * the values; this just gets them to a sensible starting shape.
   */
  applyPreset(value: string): void {
    const preset = this.subjectTypePresets.find(p => p.value === value);
    if (!preset) return;
    this.form.get('passRule')?.setValue(preset.suggestedPassRule, { emitEvent: false });
    while (this.components.length) this.components.removeAt(0);
    for (const c of preset.components) {
      this.components.push(this.buildComponentGroup(
        c.key, c.label, c.maxMarks, c.passMarks, c.trackAttendance, c.assessmentMode, c.internalSchedule));
    }
    // Auto-open customise for CUSTOM so the user immediately sees the editor.
    this.customiseComponents = value === 'CUSTOM';
  }

  /** Returns the current preset descriptor for hint text in the dialog. */
  currentPreset() {
    const v = this.form?.get('subjectType')?.value;
    return this.subjectTypePresets.find(p => p.value === v) || null;
  }

  private buildComponentGroup(
    key: string, label: string, maxMarks: number, passMarks: number,
    trackAttendance: boolean, assessmentMode: 'EXAM' | 'INTERNAL',
    internalSchedule: 'PER_TERM' | 'PER_YEAR' = 'PER_TERM',
  ): FormGroup {
    return this.fb.group({
      key: [key, Validators.required],
      label: [label, Validators.required],
      maxMarks: [maxMarks, [Validators.required, Validators.min(0)]],
      passMarks: [passMarks, [Validators.required, Validators.min(0)]],
      trackAttendance: [trackAttendance],
      assessmentMode: [assessmentMode, Validators.required],
      internalSchedule: [internalSchedule],
    });
  }

  get components(): FormArray<FormGroup> {
    return this.form.get('components') as FormArray<FormGroup>;
  }

  addComponent(): void {
    // Sensible default for the second slot: a Practical EXAM component.
    // Admin renames as needed (Internal Assessment, Project, etc.).
    this.components.push(this.buildComponentGroup(
      this.suggestKey(), 'Practical', 30, 12, true, 'EXAM'));
  }

  removeComponent(i: number): void {
    if (this.components.length <= 1) return; // must keep at least one
    this.components.removeAt(i);
  }

  /** Generate a non-clashing component key for a newly-added row. */
  private suggestKey(): string {
    const used = new Set(this.components.controls.map(c => c.get('key')?.value));
    const candidates = ['practical', 'internal', 'project', 'oral', 'viva'];
    for (const c of candidates) if (!used.has(c)) return c;
    let i = 2;
    while (used.has(`component_${i}`)) i++;
    return `component_${i}`;
  }

  // ── Data loaders ───────────────────────────────────────────────────

  loadSubjects(): void {
    this.isLoading = true;
    this.subjectService.getSubjects().subscribe({
      next: (subjects) => {
        this.dataSource.data = subjects;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private loadClassesAndYears(): void {
    // Only academic years up front. Classes load AFTER a year is picked
    // so the Class dropdown can't accidentally surface classes from
    // a different year (e.g. last year's "5" instead of this year's).
    this.apiService.getAcademicYears().subscribe({
      next: r => { this.academicYears = (r as any)?.data ?? []; },
    });
  }

  /**
   * Reload Classes scoped to the chosen academic year. Wipes any
   * previously-picked class / sections so the form can't carry a
   * stale selection from the prior year.
   */
  onYearChange(): void {
    const yearId = this.form?.get('academicYearId')?.value;
    this.classes = [];
    this.sectionsForSelectedClass = [];
    this.form?.get('classId')?.setValue('');
    this.form?.get('applyToSectionIds')?.setValue([]);
    if (!yearId) return;
    this.apiService.getClasses(yearId).subscribe({
      next: r => {
        this.classes = ((r as any)?.data ?? []).map((c: any) => ({
          classId: c.classId,
          name: c.name,
          sections: (c.sections || []).map((s: any) => ({
            sectionId: s.sectionId,
            name: s.name,
          })),
        }));
      },
    });
  }

  /**
   * Refresh the Sections picker when the admin changes Class.
   * Selecting a class pre-ticks ALL of its sections by default — that's
   * what the backend assumes when the form sends an empty array, but
   * surfacing the choice up front lets the admin uncheck sections that
   * shouldn't get this subject.
   */
  onClassChange(): void {
    const classId = this.form?.get('classId')?.value;
    const cls = this.classes.find(c => c.classId === classId);
    this.sectionsForSelectedClass = cls?.sections ?? [];
    // Default to all sections selected; admin can untick.
    this.form?.get('applyToSectionIds')?.setValue(
      this.sectionsForSelectedClass.map(s => s.sectionId)
    );
  }

  // ── Dialog open / close ────────────────────────────────────────────

  openCreateDialog(): void {
    this.buildForm();
    this.filterNameSuggestions();
    this.createDialogOpen = true;
  }

  closeCreateDialog(): void {
    this.createDialogOpen = false;
  }

  // ── Create ─────────────────────────────────────────────────────────

  createSubject(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fix the highlighted fields.', 'Close', { duration: 3000 });
      return;
    }
    // Component-level sanity check beyond per-field validators:
    // passMarks must be <= maxMarks, and component keys must be unique.
    // subjectType is a UI-only preset selector and isn't sent to the backend.
    const raw = this.form.value as any;
    const { subjectType, ...v }: { subjectType?: string } & CreateOrUpdateSubject = raw;
    const keys = new Set<string>();
    for (const c of v.components) {
      if (c.passMarks > c.maxMarks) {
        this.snackBar.open(`Pass marks for "${c.label}" cannot exceed max marks.`, 'Close', { duration: 4000 });
        return;
      }
      if (keys.has(c.key)) {
        this.snackBar.open(`Duplicate component key "${c.key}". Each component needs a unique key.`, 'Close', { duration: 4000 });
        return;
      }
      keys.add(c.key);
    }
    // Drop internalSchedule on EXAM components so the API doesn't store
    // a misleading value alongside an EXAM-mode component.
    v.components = v.components.map(c =>
      c.assessmentMode === 'INTERNAL'
        ? c
        : (() => { const { internalSchedule, ...rest } = c as any; return rest; })()
    );

    this.isCreating = true;
    this.subjectService.createSubject(v).subscribe({
      next: () => {
        this.snackBar.open(`Subject "${v.name}" created successfully`, 'Close', { duration: 3000 });
        this.closeCreateDialog();
        this.isCreating = false;
        setTimeout(() => this.loadSubjects(), 500);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to create subject';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
        this.isCreating = false;
      },
    });
  }

  // ── Delete (unchanged) ─────────────────────────────────────────────

  confirmDelete(subject: SubjectItem): void {
    this.selectedSubject = subject;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedSubject = null;
  }

  deleteSubject(): void {
    if (!this.selectedSubject) return;
    const subjectId = this.selectedSubject.subjectId;
    const name = this.selectedSubject.name;
    this.deleteDialogOpen = false;
    this.selectedSubject = null;

    this.subjectService.deleteSubject(subjectId).subscribe({
      next: () => {
        this.snackBar.open(`"${name}" deleted successfully`, 'Close', { duration: 3000 });
        setTimeout(() => this.loadSubjects(), 500);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete subject', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Display helpers ────────────────────────────────────────────────

  /**
   * One-line summary of a subject's makeup for the list view — used by
   * the "summary" column. Legacy single-type subjects fall back to
   * their `type` field; new component-shaped subjects show the
   * comma-separated component labels.
   */
  summarise(subject: SubjectItem): string {
    if (subject.components && subject.components.length > 0) {
      return subject.components.map(c => c.label).join(' + ');
    }
    if (!subject.type) return 'Theory';
    return subject.type.charAt(0).toUpperCase() + subject.type.slice(1).toLowerCase();
  }

  summaryClass(subject: SubjectItem): string {
    if (subject.components && subject.components.length > 1) return 'type-hybrid';
    const t = (subject.type || subject.components?.[0]?.key || 'theory').toLowerCase();
    if (t === 'practical') return 'type-practical';
    if (t === 'elective') return 'type-elective';
    return 'type-theory';
  }
}
