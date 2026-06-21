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
  // component-shaped subjects. Added totalMarks + passRule columns so
  // the admin can see the full subject configuration without opening
  // Edit on every row.
  // Total column removed — max/pass moved to the Exam doc, so a per-subject
  // total is no longer meaningful (Math Theory could be 40 in UT1 and 80
  // in the Final). Pass rule still drives whether report card sums or
  // checks each component.
  displayedColumns: string[] = ['name', 'code', 'class', 'summary', 'passRule', 'actions'];
  dataSource = new MatTableDataSource<SubjectItem>([]);
  isLoading = false;

  createDialogOpen = false;
  isCreating = false;
  /** When the dialog is open in edit mode, holds the existing subject's id. */
  editingSubjectId: string | null = null;
  form!: FormGroup;

  classes: Array<{ classId: string; name: string; sections?: Array<{ sectionId: string; name: string }> }> = [];
  /** Tenant-wide class lookup keyed by classId — used by the list view's
   *  "Class" column to translate {@code subject.classId} into a name +
   *  sections without having to load classes once per row. */
  private classLookup = new Map<string, { name: string; sections: Array<{ sectionId: string; name: string }> }>();

  /** Flat list of every (class, section) pair in the chosen year — drives the
   *  combined picker. Each entry's value encodes both ids so we can group by
   *  class at submit time. */
  classSectionOptions: Array<{
    key: string;            // unique value used by mat-select: `${classId}::${sectionId}`
    label: string;          // human label: "Class 1 — Section A"
    classId: string;
    sectionId: string;
    /** True when a same-named Subject in this year already claims this
     *  (class, section). Drives the `[disabled]` on the mat-option so the
     *  admin can't even try to pick a conflicting pair. Recomputed on
     *  every name-field change. */
    disabled?: boolean;
    /** Human-readable label of the subject already occupying this pair —
     *  shown in the option's hint. */
    occupiedBy?: string;
  }> = [];
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
      academicYearId: ['', Validators.required],
      // Combined Class + Section multi-select: each picked value is
      // a "${classId}::${sectionId}" key. At submit time we group by
      // classId and create one Subject doc per class, each
      // auto-attached to its picked sections. Lets the admin create
      // Kannada across (Class 1 Sec A, Sec B), (Class 2 Sec A),
      // (Class 3 Sec A) in one shot.
      classSectionKeys: [[] as string[], Validators.required],
      subjectType: ['THEORY', Validators.required],
      passRule: ['PER_COMPONENT', Validators.required],
      components: this.fb.array([this.buildComponentGroup('theory', 'Theory', 100, 35, true, 'EXAM')]),
      // Sub-parts (Physics / Chemistry / Biology under an integrated Science
      // course). Toggle below decides whether the array is exposed in the
      // form; even when toggled OFF the FormArray stays in the group so the
      // existing build/edit paths don't have to special-case its absence.
      hasSubParts: [false],
      subParts: this.fb.array([] as FormGroup[]),
    });
    // Keep components array in sync whenever the admin picks a different preset.
    this.form.get('subjectType')?.valueChanges.subscribe(v => this.applyPreset(v));
    // Recompute which (class, section) options are disabled whenever the
    // admin types/changes the Subject name. Same-named subjects in this
    // year block the pairs they already own — the admin sees them greyed
    // out with a helpful "already used by …" hint instead of running into
    // a backend rejection after hitting Save.
    this.form.get('name')?.valueChanges.subscribe(() => this.recomputeDisabledClassSections());
    this.customiseComponents = false;
  }

  /**
   * Walk the in-memory subjects list and mark every classSectionOption
   * that's already claimed by a SAME-NAMED subject in the same academic
   * year (excluding the doc being edited). Re-runs on every name change.
   */
  private recomputeDisabledClassSections(): void {
    if (!this.classSectionOptions.length) return;
    const name = (this.form?.get('name')?.value || '').trim().toLowerCase();
    const yearId = this.form?.get('academicYearId')?.value;
    if (!name || !yearId) {
      // Nothing to block until we know which name we're checking against.
      for (const opt of this.classSectionOptions) { opt.disabled = false; opt.occupiedBy = undefined; }
      return;
    }
    // Build a set of (classId::sectionId) → occupying subject name for
    // every same-named subject in this year (minus the one being edited).
    const claimed = new Map<string, string>();
    const all = this.dataSource.data || [];
    for (const sub of all) {
      if (!sub || sub.subjectId === this.editingSubjectId) continue;
      if ((sub.name || '').trim().toLowerCase() !== name) continue;
      if (sub.academicYearId && sub.academicYearId !== yearId) continue;
      const assignments = sub.assignments && sub.assignments.length > 0
        ? sub.assignments
        : (sub.classId ? [{ classId: sub.classId, sectionIds: [] }] : []);
      for (const a of assignments) {
        for (const secId of (a.sectionIds || [])) {
          claimed.set(`${a.classId}::${secId}`, sub.name);
        }
      }
    }
    for (const opt of this.classSectionOptions) {
      const occupier = claimed.get(opt.key);
      opt.disabled = !!occupier;
      opt.occupiedBy = occupier;
    }
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
    // Max + pass marks moved to the Exam doc — admin sets them per exam in
    // Exam Config so the same Math · Theory can be 40+10 for UT1 and 80+20
    // for the Final. The fields stay on the form group so legacy data
    // still serializes back to the API; we just don't render inputs.
    return this.fb.group({
      key: [key, Validators.required],
      label: [label, Validators.required],
      maxMarks: [maxMarks ?? 0, [Validators.min(0)]],
      passMarks: [passMarks ?? 0, [Validators.min(0)]],
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

  // ── Sub-parts (teaching axis — orthogonal to components) ───────────

  get subParts(): FormArray<FormGroup> {
    return this.form.get('subParts') as FormArray<FormGroup>;
  }

  /** Build one sub-part form group. Key auto-derives from label on change so
   *  admins don't have to think about machine identifiers; code is optional. */
  private buildSubPartGroup(key: string, label: string, code: string): FormGroup {
    const grp = this.fb.group({
      key: [key, Validators.required],
      label: [label, Validators.required],
      code: [code],
    });
    grp.get('label')?.valueChanges.subscribe((newLabel: string | null) => {
      const slug = this.toSlug(newLabel || '');
      if (slug && grp.get('key')?.value !== slug) {
        grp.get('key')?.setValue(slug, { emitEvent: false });
      }
    });
    return grp;
  }

  addSubPart(): void {
    // Empty row by default so admin types straight into the label field;
    // key auto-fills as they type via the valueChanges hook above.
    this.subParts.push(this.buildSubPartGroup('', '', ''));
  }

  removeSubPart(i: number): void {
    this.subParts.removeAt(i);
    if (this.subParts.length === 0) {
      this.form.get('hasSubParts')?.setValue(false, { emitEvent: false });
    }
  }

  /** Toggle handler — adds an initial empty row on switch-on so admin sees
   *  the editor primed and ready, clears all rows on switch-off. */
  onHasSubPartsChange(checked: boolean): void {
    if (checked && this.subParts.length === 0) {
      this.addSubPart();
    } else if (!checked) {
      while (this.subParts.length) this.subParts.removeAt(0);
    }
  }

  /** Lowercase snake_case slug for a sub-part label. "Physics (Sr)" → "physics_sr". */
  private toSlug(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /** Comma-joined list of sub-part labels, used by the list-row tooltip. */
  subPartsTooltip(subject: SubjectItem): string {
    const sps = subject.subParts || [];
    return sps.map(sp => sp.label).join(', ');
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
    // Only academic years up front. Classes inside the dialog load AFTER
    // a year is picked so the picker can't surface a class from another
    // year. The tenant-wide class lookup below is a separate concern — it
    // feeds the list view's "Class" column so existing subjects can show
    // their class + sections regardless of which year the admin's on.
    this.apiService.getAcademicYears().subscribe({
      next: r => { this.academicYears = (r as any)?.data ?? []; },
    });
    this.apiService.getClasses().subscribe({
      next: r => {
        const list = (r as any)?.data ?? [];
        this.classLookup = new Map(list.map((c: any) => [
          c.classId,
          {
            name: c.name,
            sections: (c.sections || []).map((s: any) => ({ sectionId: s.sectionId, name: s.name })),
          },
        ]));
      },
    });
  }

  /** Comma-list of class names this subject is assigned to. Falls back
   *  to the legacy single classId for any pre-migration rows. */
  classLabelFor(subject: SubjectItem): string {
    if (subject.assignments && subject.assignments.length > 0) {
      const names = subject.assignments
        .map(a => this.classLookup.get(a.classId)?.name || a.classId)
        .filter(Boolean);
      return names.join(', ');
    }
    if (subject.classId) {
      return this.classLookup.get(subject.classId)?.name || subject.classId;
    }
    return '—';
  }

  /**
   * Richer class-with-sections list for the table — renders as
   * "1st (A, B), 2nd (A)". Used by the dedicated Class column so the
   * admin can see at a glance which sections of each class the subject
   * is attached to, without opening Edit. Falls back to bare class name
   * when section ids can't be resolved (e.g. legacy rows).
   */
  classDetailFor(subject: SubjectItem): Array<{ className: string; sectionNames: string[] }> {
    const out: Array<{ className: string; sectionNames: string[] }> = [];
    const assignments = subject.assignments && subject.assignments.length > 0
      ? subject.assignments
      : (subject.classId ? [{ classId: subject.classId, sectionIds: [] }] : []);
    for (const a of assignments) {
      const cls = this.classLookup.get(a.classId);
      const className = cls?.name || a.classId;
      const sectionNames = (a.sectionIds || [])
        .map(sid => cls?.sections.find(s => s.sectionId === sid)?.name || '')
        .filter(Boolean);
      out.push({ className, sectionNames });
    }
    return out;
  }

  /** Sum of every component's max marks — the headline number on the
   *  report card. Returns 0 for legacy single-type subjects. */
  totalMarks(subject: SubjectItem): number {
    if (!subject.components || subject.components.length === 0) return 0;
    return subject.components.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);
  }

  /** Human-readable pass-rule label for the table chip. */
  passRuleLabel(subject: SubjectItem): string {
    return subject.passRule === 'COMBINED' ? 'Combined total' : 'Per component';
  }

  /**
   * One chip per component for the Components column — each carries
   * the label, max marks, assessment mode and attendance flag so the
   * admin can read the full makeup at a glance.
   */
  componentChips(subject: SubjectItem): Array<{
    label: string; maxMarks: number; passMarks: number;
    mode: 'EXAM' | 'INTERNAL'; trackAttendance: boolean;
  }> {
    if (!subject.components || subject.components.length === 0) {
      // Legacy single-type fallback — surface the old `type` field as
      // a single chip so the row isn't blank.
      const legacy = subject.type
        ? subject.type.charAt(0).toUpperCase() + subject.type.slice(1).toLowerCase()
        : 'Theory';
      return [{ label: legacy, maxMarks: 100, passMarks: 35, mode: 'EXAM', trackAttendance: true }];
    }
    return subject.components.map(c => ({
      label: c.label,
      maxMarks: Number(c.maxMarks) || 0,
      passMarks: Number(c.passMarks) || 0,
      mode: c.assessmentMode,
      trackAttendance: !!c.trackAttendance,
    }));
  }

  /**
   * Reload classes (and the flattened class–section picker options)
   * scoped to the chosen academic year. Wipes any previously-picked
   * class+section combo so the form can't carry a stale selection.
   */
  onYearChange(): void {
    const yearId = this.form?.get('academicYearId')?.value;
    this.classes = [];
    this.classSectionOptions = [];
    this.form?.get('classSectionKeys')?.setValue([]);
    if (!yearId) return;
    this.apiService.getClasses(yearId).subscribe({
      next: r => {
        const list = ((r as any)?.data ?? []).map((c: any) => ({
          classId: c.classId,
          name: c.name,
          sections: (c.sections || []).map((s: any) => ({
            sectionId: s.sectionId,
            name: s.name,
          })),
        }));
        this.classes = list;
        // Flatten into one option per (class, section). Labels read
        // "Class 1 — Section A" / "1 — A" depending on what the school
        // named their classes. Order: class name, then section name.
        const opts: typeof this.classSectionOptions = [];
        for (const c of list) {
          for (const s of (c.sections || [])) {
            opts.push({
              key: `${c.classId}::${s.sectionId}`,
              label: `${c.name} — ${s.name}`,
              classId: c.classId,
              sectionId: s.sectionId,
            });
          }
        }
        opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
        this.classSectionOptions = opts;
        // After options are built, immediately grey out anything already
        // owned by a same-named subject. Triggers off the current name
        // value; will re-fire on every subsequent name keystroke too.
        this.recomputeDisabledClassSections();
      },
    });
  }

  // ── Dialog open / close ────────────────────────────────────────────

  openCreateDialog(): void {
    this.editingSubjectId = null;
    this.buildForm();
    this.filterNameSuggestions();
    this.createDialogOpen = true;
  }

  /**
   * Open the dialog in edit mode for the given subject. Pre-fills the
   * form with name + code + pass rule + components, infers the
   * subject's preset by inspecting its component shape, and pre-selects
   * just this subject's (class, sections) entry in the combined picker.
   *
   * <p>In edit mode the combined picker stays single-class — editing a
   * subject is always for the one class it belongs to. Multi-class
   * "spread" only makes sense at create time.
   */
  openEditDialog(subject: SubjectItem): void {
    this.editingSubjectId = subject.subjectId;
    this.buildForm();
    this.filterNameSuggestions();
    this.form.patchValue({
      name: subject.name,
      code: subject.code || '',
      academicYearId: subject.academicYearId || '',
      passRule: subject.passRule || 'PER_COMPONENT',
    });
    // Re-create the components FormArray to match the existing subject.
    const comps = this.form.get('components') as any;
    while (comps.length) comps.removeAt(0);
    for (const c of (subject.components || [])) {
      comps.push(this.buildComponentGroup(
        c.key, c.label, c.maxMarks ?? 0, c.passMarks ?? 0,
        c.trackAttendance, c.assessmentMode, c.internalSchedule || 'PER_TERM'));
    }
    // Default to "Custom" preset so the components stay editable.
    this.form.get('subjectType')?.setValue('CUSTOM', { emitEvent: false });
    this.customiseComponents = true;

    // Sub-parts hydration. Restore each saved sub-part as a form row +
    // flip the toggle on so the editor renders. Empty list → toggle
    // stays OFF (default from buildForm).
    const sps = this.form.get('subParts') as any;
    while (sps.length) sps.removeAt(0);
    const savedSubParts = subject.subParts || [];
    if (savedSubParts.length > 0) {
      this.form.get('hasSubParts')?.setValue(true, { emitEvent: false });
      for (const sp of savedSubParts) {
        sps.push(this.buildSubPartGroup(sp.key, sp.label, sp.code || ''));
      }
    }
    // Load classes for this subject's year, then build the class-section
    // options and pre-select THIS subject's class with its sections that
    // include this subject's id.
    if (subject.academicYearId) {
      this.apiService.getClasses(subject.academicYearId).subscribe(r => {
        const list = ((r as any)?.data ?? []);
        this.classes = list.map((c: any) => ({
          classId: c.classId,
          name: c.name,
          sections: (c.sections || []).map((s: any) => ({
            sectionId: s.sectionId,
            name: s.name,
          })),
        }));
        const opts: typeof this.classSectionOptions = [];
        const preselect: string[] = [];
        // Build a set of every (classId, sectionId) pair this subject is
        // currently assigned to. Drives the pre-tick state of the
        // combined multi-select on edit.
        const assigned = new Set<string>();
        for (const a of (subject.assignments || [])) {
          for (const sid of (a.sectionIds || [])) {
            assigned.add(`${a.classId}::${sid}`);
          }
        }
        for (const c of list) {
          for (const s of (c.sections || [])) {
            const key = `${c.classId}::${s.sectionId}`;
            opts.push({
              key,
              label: `${c.name} — ${s.name}`,
              classId: c.classId,
              sectionId: s.sectionId,
            });
            if (assigned.has(key)) preselect.push(key);
          }
        }
        opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
        this.classSectionOptions = opts;
        this.form.get('classSectionKeys')?.setValue(preselect);
        // Grey out pairs taken by OTHER same-named subjects (editingSubjectId
        // is excluded inside the helper, so this subject's own pairs stay
        // selectable / pre-ticked).
        this.recomputeDisabledClassSections();
      });
    }
    this.createDialogOpen = true;
  }

  closeCreateDialog(): void {
    this.createDialogOpen = false;
    this.editingSubjectId = null;
  }

  // ── Create ─────────────────────────────────────────────────────────

  createSubject(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fix the highlighted fields.', 'Close', { duration: 3000 });
      return;
    }
    // Component-level sanity check beyond per-field validators.
    const raw = this.form.value as any;
    const components = raw.components as Array<any>;
    const keys = new Set<string>();
    for (const c of components) {
      // Max/pass marks moved to the Exam doc — no per-component check needed
      // here. Subject form is now structure-only (label, mode, attendance).
      if (keys.has(c.key)) {
        this.snackBar.open(`Duplicate component key "${c.key}". Each component needs a unique key.`, 'Close', { duration: 4000 });
        return;
      }
      keys.add(c.key);
    }
    // Drop internalSchedule on EXAM components so the API doesn't store
    // a misleading value alongside an EXAM-mode component.
    const cleanComponents = components.map(c =>
      c.assessmentMode === 'INTERNAL'
        ? c
        : (() => { const { internalSchedule, ...rest } = c as any; return rest; })()
    );

    // Group picked class-section keys by classId — one Subject doc per
    // class, each auto-attached to its picked sections. So Kannada for
    // (1-A, 1-B, 2-A, 3-A) becomes three docs:
    //   - Class 1 (sections A, B)
    //   - Class 2 (section A)
    //   - Class 3 (section A)
    const picked: string[] = raw.classSectionKeys || [];
    if (picked.length === 0) {
      this.snackBar.open('Pick at least one Class — Section to apply this subject to.', 'Close', { duration: 4000 });
      return;
    }
    const byClass = new Map<string, string[]>();
    for (const key of picked) {
      const [classId, sectionId] = key.split('::');
      if (!classId || !sectionId) continue;
      if (!byClass.has(classId)) byClass.set(classId, []);
      byClass.get(classId)!.push(sectionId);
    }

    // ONE submission, ONE Subject document — the assignments array
    // carries every picked (class, section) pair. The backend creates
    // a single doc and walks its assignments to attach the subject to
    // each class's matching sections.
    const assignments = Array.from(byClass.entries()).map(([classId, sectionIds]) => ({
      classId, sectionIds,
    }));
    // Sub-parts — only forwarded when the toggle is ON. Trim out empties
    // (admin may have added a row then left it blank) and reject duplicates
    // so the saved Subject has a clean canonical list.
    const subPartsRaw = (raw.subParts as Array<any>) || [];
    const subParts = raw.hasSubParts
      ? subPartsRaw
          .filter(sp => (sp.label || '').trim().length > 0)
          .map(sp => ({
            key: (sp.key || this.toSlug(sp.label)).trim(),
            label: (sp.label || '').trim(),
            code: (sp.code || '').trim() || undefined,
          }))
      : [];
    if (raw.hasSubParts) {
      const seenKeys = new Set<string>();
      for (const sp of subParts) {
        if (!sp.key) continue;
        if (seenKeys.has(sp.key)) {
          this.snackBar.open(`Duplicate sub-part "${sp.label}". Each sub-part needs a unique label.`, 'Close', { duration: 4000 });
          return;
        }
        seenKeys.add(sp.key);
      }
      if (subParts.length === 0) {
        this.snackBar.open('Sub-parts is ON but no labels were entered. Add at least one or switch the toggle off.', 'Close', { duration: 4000 });
        return;
      }
    }

    const body: CreateOrUpdateSubject = {
      name: raw.name,
      code: raw.code,
      academicYearId: raw.academicYearId,
      passRule: raw.passRule,
      components: cleanComponents,
      assignments,
      subParts,
    };

    this.isCreating = true;
    const call$ = this.editingSubjectId
      ? this.subjectService.updateSubject(this.editingSubjectId, body)
      : this.subjectService.createSubject(body);
    call$.subscribe({
      next: () => {
        const verb = this.editingSubjectId ? 'Updated' : 'Created';
        this.snackBar.open(
          `${verb} "${raw.name}" across ${assignments.length} class${assignments.length === 1 ? '' : 'es'}.`,
          'Close', { duration: 3000 });
        this.isCreating = false;
        this.closeCreateDialog();
        setTimeout(() => this.loadSubjects(), 500);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save subject', 'Close', { duration: 5000 });
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
