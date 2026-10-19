import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';
import { AcademicYear, SchoolClass } from '../../../core/models';

/** Catalog entry fetched from /api/v1/exam-types — drives the slot's Type dropdown. */
interface ExamTypeCatalogRow {
  id: string;
  name: string;
  key?: string;
  color?: string;
  displayOrder?: number;
  status?: string;
}

interface SubjectOverride {
  subjectId: string;
  rawMax: number;
  weightMax: number;
  passingMarks: number | null;
  // Only used when the parent slot has pullForward set; null falls back
  // to the slot-level pullForward.contributionMax.
  pulledContributionMax: number | null;
}

/**
 * Per-slot subject roster entry. One per subject that should get an Exam
 * rolled out for this slot. Replaces SubjectOverride as the primary surface;
 * overrides live on as a fine-tuning layer for legacy schemes.
 */
interface SubjectConfig {
  subjectId: string;
  rawMax: number;
  weightMax: number;
  passingMarks: number | null;
  pulledContributionMax: number | null;
}

/** Subjects fetched for the scheme's applicable classes (+ core flag). */
interface SchemeSubject {
  subjectId: string;
  name: string;
  coreSubject: boolean;
  /** Class names (within the scheme) that teach this subject — disambiguates duplicates. */
  classNames: string[];
  /** Labels of this subject's own components (Theory, Practical, IA, …).
   *  Kept for backward compat; new code uses componentDefs. */
  componentLabels: string[];
  /** Full (key, label) pairs for this subject's components — drives the strict
   *  component picker in the slot editor. */
  componentDefs: { key: string; label: string }[];
}

interface SlotSubComponent {
  key: string;
  label: string;
  maxMarks: number;
  passingMarks: number | null;
}

interface SlotComponent {
  /** MUST match a Subject.Component.key on at least one applicable subject. */
  key: string;
  label: string;
  maxMarks: number;
  passingMarks: number | null;
  /** Null/empty → marks entered at component level. Non-empty → one column
   *  per sub-part at marks entry, component total = sum of sub-part marks. */
  subComponents: SlotSubComponent[] | null;
}

interface PullForward {
  fromSlotKeys: string[];
  contributionMax: number;
}

interface Slot {
  key: string;
  label: string;
  /** Reference to an ExamType catalog entry id. Drives the slot's color + the
   *  stamped exam.examType on rollout. */
  typeId: string;
  term: string;
  rawMax: number;
  weightMax: number;
  passingMarks: number | null;
  subjectOverrides: SubjectOverride[];

  // Phase 2 — null = feature off for this slot (1st–8th stays simple)
  components: SlotComponent[] | null;
  ownRawMax: number | null;
  pullForward: PullForward | null;
  includeInGrandTotal: boolean;

  // Per-slot subject roster — one row per subject that will get an Exam.
  // Null OR empty = fall back to legacy behaviour (apply slot defaults to
  // all core subjects via rollout). When non-empty, this is the source of
  // truth for which subjects get rolled out and at what marks.
  subjectConfigs: SubjectConfig[] | null;
}

interface SchemeForm {
  id?: string;
  name: string;
  displayOrder: number;
  defaultMaxMarks?: number | null;
  description?: string;
  applicableClassIds: string[];
  slots: Slot[];
  academicYearId: string | null;
  /** Scheme-wide pass bar as a whole-number percentage (0..100). Drives
   *  every slot / subject-row / component pass default; "Sync" propagates
   *  changes to existing rows. */
  passingPercent: number;
}

@Component({
  selector: 'app-exam-type-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDividerModule, MatExpansionModule,
    MatSlideToggleModule, MatChipsModule, MatSnackBarModule, PageHeaderComponent,
  ],
  templateUrl: './exam-type-editor.component.html',
  styleUrl: './exam-type-editor.component.scss',
})
export class ExamTypeEditorComponent implements OnInit {
  isEditing = false;
  schemeId: string | null = null;
  isLoading = false;
  isSaving = false;

  form: SchemeForm = this.blankForm();

  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];

  /** classId → scheme name that already covers it in the chosen year. */
  takenByOtherScheme: Record<string, string> = {};
  /** Scheme name occupying "all classes" in the chosen year (null when none). */
  allClassesTakenBy: string | null = null;

  /** Subjects taught in this scheme's applicable classes — seeds slot roster. */
  schemeSubjects: SchemeSubject[] = [];
  schemeSubjectsLoaded = false;

  /** Catalog loaded from /api/v1/exam-types — drives the per-slot Type dropdown.
   *  Resolved lazily; while loading, mkSlot leaves typeId blank and the UI
   *  shows the first catalog entry once it arrives. */
  typeCatalog: ExamTypeCatalogRow[] = [];
  typeCatalogLoaded = false;

  readonly presets = [
    {
      name: 'Karnataka 1st–8th (FA1..FA4 + SA1, SA2)',
      description: 'FA out of 20→10 each, SA out of 50→30 each. Grand total 100.',
      slots: [
        this.mkSlot('FA1', 'FA', 'Term 1', 20, 10),
        this.mkSlot('FA2', 'FA', 'Term 1', 20, 10),
        this.mkSlot('SA1', 'SA', 'Term 1', 50, 30),
        this.mkSlot('FA3', 'FA', 'Term 2', 20, 10),
        this.mkSlot('FA4', 'FA', 'Term 2', 20, 10),
        this.mkSlot('SA2', 'SA', 'Term 2', 50, 30),
      ],
    },
    {
      name: 'Karnataka 9/10 (SSLC — FA 15+15+20, SA pulls FAs)',
      description:
        'FA1..FA4 each 50 (components 15+15+20). SA1 = own 80 + 20 pulled from FA1+FA2 (100). ' +
        'SA2 = own 80 + 20 pulled from FA1..FA4 (100). SA1 excluded from grand total — SA2 already rolls up every FA.',
      slots: [
        this.mkFaWithComponents('FA1', 'Term 1'),
        this.mkFaWithComponents('FA2', 'Term 1'),
        this.mkSaWithPull('SA1', 'Term 1', ['fa1', 'fa2'], /*includeInGrand*/ false),
        this.mkFaWithComponents('FA3', 'Term 2'),
        this.mkFaWithComponents('FA4', 'Term 2'),
        this.mkSaWithPull('SA2', 'Term 2', ['fa1', 'fa2', 'fa3', 'fa4'], /*includeInGrand*/ true),
      ],
    },
    {
      name: 'CBSE Term-1 / Term-2',
      description: 'Two terms, each with periodic (raw 20→10) + term exam (raw 80→40).',
      slots: [
        this.mkSlot('PT1', 'FA', 'Term 1', 20, 10),
        this.mkSlot('Term 1 Exam', 'SA', 'Term 1', 80, 40),
        this.mkSlot('PT2', 'FA', 'Term 2', 20, 10),
        this.mkSlot('Term 2 Exam', 'SA', 'Term 2', 80, 40),
      ],
    },
    {
      name: 'Simple Annual (single exam)',
      description: 'One-shot 100-mark annual exam (no weighting).',
      slots: [this.mkSlot('Annual', 'SA', 'Annual', 100, 100)],
    },
  ];

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEditing = !!id && id !== 'new';
    this.schemeId = this.isEditing ? id : null;

    this.loadClasses();
    this.loadTypeCatalog();

    if (this.isEditing && this.schemeId) {
      this.loadExistingScheme(this.schemeId);
      // Edit mode knows the scheme id → backend endpoint is cheap.
      this.loadSchemeSubjects();
    } else {
      this.loadNextDisplayOrder();
    }
  }

  /** Fetches /api/v1/exam-types → used to populate the per-slot Type dropdown
   *  and to resolve legacy {@code kind} values ("FA"/"SA"/"OTHER") to the
   *  corresponding catalog entry on load. */
  private loadTypeCatalog(): void {
    this.api.getExamTypes(false).subscribe({
      next: (res: any) => {
        this.typeCatalog = (res?.data || []).map((r: any) => ({
          id: r.id, name: r.name, key: r.key, color: r.color,
          displayOrder: r.displayOrder, status: r.status,
        }));
        this.typeCatalogLoaded = true;
        // Any slots with blank typeId get the default (first catalog entry).
        this.applyDefaultTypeIdWhereMissing();
      },
      error: () => { this.typeCatalog = []; this.typeCatalogLoaded = true; },
    });
  }

  /** Fallback default so freshly-added slots don't sit with an empty type.
   *  Prefers an FA/SA match on the slot's label prefix so a slot added as
   *  "SA1" picks the SA catalog entry even if the catalog arrived after the
   *  add; everything else falls back to the first catalog entry. */
  private applyDefaultTypeIdWhereMissing(): void {
    if (!this.typeCatalog.length) return;
    const faId = this.typeByKey('FA')?.id;
    const saId = this.typeByKey('SA')?.id;
    const fallback = faId || this.typeCatalog[0].id;
    for (const s of this.form.slots || []) {
      if (s.typeId) continue;
      const label = (s.label || '').toUpperCase();
      if (label.startsWith('SA') && saId) s.typeId = saId;
      else if (label.startsWith('FA') && faId) s.typeId = faId;
      else s.typeId = fallback;
    }
  }

  typeById(id: string | null | undefined): ExamTypeCatalogRow | undefined {
    if (!id) return undefined;
    return this.typeCatalog.find(t => t.id === id);
  }

  typeByKey(key: string): ExamTypeCatalogRow | undefined {
    return this.typeCatalog.find(t => t.key === key);
  }

  typeNameFor(id: string | null | undefined): string {
    return this.typeById(id)?.name || '—';
  }

  typeColorFor(id: string | null | undefined): string {
    return this.typeById(id)?.color || '#6b7280';
  }

  /** True when the slot's type is the SA catalog entry — used by the
   *  grand-total scope presets ("SAs only", "Only the final SA"). */
  private isSaSlot(s: Slot): boolean {
    return this.typeById(s.typeId)?.key === 'SA';
  }

  private resolveTypeIdFromKind(kind: string | undefined): string {
    if (!kind) return this.typeCatalog[0]?.id || '';
    return this.typeByKey(kind.toUpperCase())?.id
        || this.typeCatalog[0]?.id
        || '';
  }

  /** Called by the applicable-classes multi-select on change. */
  onApplicableClassesChange(): void {
    // In create mode we rebuild the scheme-subject union whenever the admin
    // tweaks which classes are in scope. In edit mode the backend endpoint
    // uses the saved scheme's classes, so we re-fetch after save instead.
    if (!this.isEditing) this.loadSchemeSubjects();
  }

  /**
   * (Re)compute which classes are already covered by another scheme in the
   * form's current academic year. Called on load, on year change, and after
   * the schemes list arrives. The current scheme (`schemeId`) is excluded
   * so its own classes don't show as "taken".
   */
  refreshTakenClasses(): void {
    this.takenByOtherScheme = {};
    this.allClassesTakenBy = null;
    const yearId = this.form.academicYearId;
    if (!yearId) return;
    this.api.getExamSchemes(true, yearId).subscribe({
      next: (res: any) => {
        const rows = (res?.data || []) as any[];
        for (const r of rows) {
          if (r.id === this.schemeId) continue;
          if (r.status === 'ARCHIVED') continue;
          const ids: string[] = Array.isArray(r.applicableClassIds) ? r.applicableClassIds : [];
          if (ids.length === 0) {
            this.allClassesTakenBy = r.name;
          } else {
            for (const cid of ids) {
              if (!this.takenByOtherScheme[cid]) {
                this.takenByOtherScheme[cid] = r.name;
              }
            }
          }
        }
      },
    });
  }

  onYearChange(): void {
    // When the admin switches to a different academic year, any class picks
    // they made are checked against that year's schemes. Classes that would
    // conflict are kept but surface as disabled with the "taken by …" hint.
    this.refreshTakenClasses();
  }

  classDisabled(classId: string): boolean {
    if (this.allClassesTakenBy) return true;
    return !!this.takenByOtherScheme[classId];
  }

  classConflictLabel(classId: string): string | null {
    if (this.allClassesTakenBy) return `All classes taken by "${this.allClassesTakenBy}"`;
    return this.takenByOtherScheme[classId]
      ? `Taken by "${this.takenByOtherScheme[classId]}"`
      : null;
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit scheme' : 'New scheme';
  }

  // ── Loaders ──────────────────────────────────────────────────────────

  private loadClasses(): void {
    this.api.getAcademicYears().subscribe({
      next: (res: any) => {
        const years: AcademicYear[] = Array.isArray(res?.data) ? res.data : [];
        this.academicYears = years;
        const current = years.find(y => (y as any).current) || years[0];
        if (current?.academicYearId) {
          // Default new schemes to the current year; edit mode will overwrite
          // this once rowToForm runs with the saved value.
          if (!this.isEditing && !this.form.academicYearId) {
            this.form.academicYearId = current.academicYearId;
          }
          this.api.getClasses(current.academicYearId).subscribe({
            next: (r: any) => {
              this.classes = Array.isArray(r?.data) ? r.data : [];
              this.refreshTakenClasses();
            },
          });
        }
      },
    });
  }

  private loadNextDisplayOrder(): void {
    // Pulls the full list once so the new scheme gets a sensible display order
    // without needing a dedicated endpoint.
    this.api.getExamSchemes(true).subscribe({
      next: (res: any) => {
        const rows = res?.data || [];
        const maxOrder = rows.reduce((m: number, r: any) => Math.max(m, r.displayOrder || 0), 0);
        this.form.displayOrder = maxOrder + 1;
      },
    });
  }

  private loadExistingScheme(id: string): void {
    this.isLoading = true;
    this.api.getExamSchemes(true).subscribe({
      next: (res: any) => {
        const row = (res?.data || []).find((r: any) => r.id === id);
        if (!row) {
          this.snackBar.open('Scheme not found', 'Close', { duration: 3000 });
          this.router.navigate(['/exam-types']);
          return;
        }
        this.form = this.rowToForm(row);
        this.isLoading = false;
        this.refreshTakenClasses();
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load scheme', 'Close', { duration: 3000 });
      },
    });
  }

  private rowToForm(row: any): SchemeForm {
    const form: SchemeForm = {
      id: row.id,
      name: row.name || '',
      displayOrder: row.displayOrder || 1,
      defaultMaxMarks: row.defaultMaxMarks ?? null,
      description: row.description || '',
      applicableClassIds: Array.isArray(row.applicableClassIds) ? [...row.applicableClassIds] : [],
      slots: [],
      academicYearId: row.academicYearId || null,
      // Legacy docs don't carry passingPercent → default to 35.
      passingPercent: row.passingPercent == null ? 35 : Number(row.passingPercent),
    };
    // Normalize slots AFTER passingPercent is set so the backfill helpers
    // (defaultSlotPass / defaultComponentPass) see the loaded percent.
    this.form = form;
    form.slots = Array.isArray(row.slots) ? row.slots.map((s: any) => this.normalizeSlot(s)) : [];
    return form;
  }

  private normalizeSlot(s: any): Slot {
    return {
      key: s.key || '',
      label: s.label || '',
      // Prefer the explicit typeId from the backend; fall back to the legacy
      // kind enum (local test data from before the split) when typeId is null.
      typeId: s.typeId || this.resolveTypeIdFromKind(s.kind),
      term: s.term || '',
      rawMax: Number(s.rawMax) || 0,
      weightMax: Number(s.weightMax) || 0,
      // Legacy schemes may have passingMarks=null; backfill to the 40%-of-raw
      // default on load so the field never shows blank in the editor.
      passingMarks: s.passingMarks == null
        ? this.defaultSlotPass(Number(s.rawMax) || 0)
        : Number(s.passingMarks),
      subjectOverrides: Array.isArray(s.subjectOverrides)
        ? s.subjectOverrides.map((o: any) => ({
            subjectId: o.subjectId || '',
            rawMax: Number(o.rawMax) || 0,
            weightMax: Number(o.weightMax) || 0,
            passingMarks: o.passingMarks == null ? null : Number(o.passingMarks),
            pulledContributionMax: o.pulledContributionMax == null
              ? null
              : Number(o.pulledContributionMax),
          }))
        : [],
      components: Array.isArray(s.components)
        ? s.components.map((c: any) => ({
            key: c.key || '',
            label: c.label || '',
            maxMarks: Number(c.maxMarks) || 0,
            passingMarks: c.passingMarks == null
              ? this.defaultComponentPass(Number(c.maxMarks) || 0)
              : Number(c.passingMarks),
            subComponents: Array.isArray(c.subComponents) && c.subComponents.length > 0
              ? c.subComponents.map((sc: any) => ({
                  key: sc.key || '',
                  label: sc.label || '',
                  maxMarks: Number(sc.maxMarks) || 0,
                  passingMarks: sc.passingMarks == null
                    ? this.defaultComponentPass(Number(sc.maxMarks) || 0)
                    : Number(sc.passingMarks),
                }))
              : null,
          }))
        : null,
      ownRawMax: s.ownRawMax == null ? null : Number(s.ownRawMax),
      pullForward: s.pullForward ? {
        fromSlotKeys: Array.isArray(s.pullForward.fromSlotKeys) ? [...s.pullForward.fromSlotKeys] : [],
        contributionMax: Number(s.pullForward.contributionMax) || 0,
      } : null,
      includeInGrandTotal: s.includeInGrandTotal == null ? true : !!s.includeInGrandTotal,
      subjectConfigs: this.resolveSubjectConfigs(s),
    };
  }

  /**
   * Prefers the explicit {@code subjectConfigs} list. Falls back to migrating
   * any legacy {@code subjectOverrides} rows into the new shape so a scheme
   * created before the roster UI shipped doesn't lose its per-subject edits
   * when the admin opens it in the editor.
   */
  private resolveSubjectConfigs(s: any): SubjectConfig[] | null {
    if (Array.isArray(s.subjectConfigs) && s.subjectConfigs.length > 0) {
      return s.subjectConfigs.map((c: any) => {
        const raw = Number(c.rawMax) || 0;
        return {
          subjectId: c.subjectId || '',
          rawMax: raw,
          weightMax: Number(c.weightMax) || 0,
          // Backfill null passing marks with 40% of this row's raw so legacy
          // scheme docs don't render the Pass column empty.
          passingMarks: c.passingMarks == null ? this.defaultSlotPass(raw) : Number(c.passingMarks),
          pulledContributionMax: c.pulledContributionMax == null ? null : Number(c.pulledContributionMax),
        };
      });
    }
    if (Array.isArray(s.subjectOverrides) && s.subjectOverrides.length > 0) {
      return s.subjectOverrides.map((o: any) => {
        const raw = Number(o.rawMax) || 0;
        return {
          subjectId: o.subjectId || '',
          rawMax: raw,
          weightMax: Number(o.weightMax) || 0,
          passingMarks: o.passingMarks == null ? this.defaultSlotPass(raw) : Number(o.passingMarks),
          pulledContributionMax: o.pulledContributionMax == null ? null : Number(o.pulledContributionMax),
        };
      });
    }
    return null;
  }

  /** Common sub-component labels — drives the Label dropdown. First entry
   *  is the default when a new component is added. */
  readonly COMMON_COMPONENT_LABELS = [
    'Theory', 'Written', 'Oral', 'Practical', 'Project', 'IA', 'Activity', 'Component',
  ];

  /** Returns the active pass percent as a decimal fraction (e.g. 35 → 0.35).
   *  Clamps to [0, 1] so a stray typo in the input doesn't produce negative or
   *  overshoot bars. Reads from the live form so edits take effect on every
   *  subsequent default lookup. */
  private passFraction(): number {
    const pct = Number(this.form?.passingPercent);
    if (!Number.isFinite(pct)) return 0.35;
    return Math.max(0, Math.min(100, pct)) / 100;
  }

  /** Pass bar for a slot / subject-row — rounded down. */
  private defaultSlotPass(rawMax: number): number {
    return Math.floor((Number(rawMax) || 0) * this.passFraction());
  }

  /** Pass bar for a sub-component — same percent as slot level. */
  private defaultComponentPass(maxMarks: number): number {
    return Math.floor((Number(maxMarks) || 0) * this.passFraction());
  }

  /** Walk the form and overwrite every slot / subject-row / sub-component
   *  pass with {@code max × passingPercent}. Admin triggers this via the
   *  Sync button after they change the percent. */
  syncPassingMarks(): void {
    for (const s of this.form.slots || []) {
      // Pass bars are always of RAW — the paper is evaluated on raw, and
      // weighted / pulled are only applied when the grand total is computed.
      s.passingMarks = this.defaultSlotPass(s.rawMax);
      if (Array.isArray(s.components)) {
        for (const c of s.components) {
          c.passingMarks = this.defaultComponentPass(c.maxMarks);
        }
      }
      if (Array.isArray(s.subjectConfigs)) {
        for (const sc of s.subjectConfigs) {
          sc.passingMarks = this.defaultSlotPass(sc.rawMax);
        }
      }
    }
    this.snackBar.open(
      `Pass marks synced to ${this.form.passingPercent}% across the scheme`,
      'Close', { duration: 2500 });
  }

  /** ngModelChange handler for slot.rawMax — recomputes slot pass + any
   *  subject-row pass that mirrors it. Admin's manual pass edits DO get
   *  overwritten; the user asked for pass to always track the current raw. */
  onSlotRawChanged(slot: Slot): void {
    slot.passingMarks = this.defaultSlotPass(slot.rawMax);
    if (Array.isArray(slot.subjectConfigs)) {
      for (const sc of slot.subjectConfigs) {
        // Mirror raw change into every row whose raw wasn't already overridden
        // away from the slot default — simplest rule: always re-sync.
        sc.passingMarks = this.defaultSlotPass(sc.rawMax);
      }
    }
  }

  /** ngModelChange handler for a subject-row's rawMax — recomputes its pass. */
  onRowRawChanged(cfg: SubjectConfig): void {
    cfg.passingMarks = this.defaultSlotPass(cfg.rawMax);
  }

  /** ngModelChange handler for a sub-component's maxMarks — recomputes pass. */
  onComponentMaxChanged(comp: SlotComponent): void {
    comp.passingMarks = this.defaultComponentPass(comp.maxMarks);
  }

  /** typeKey ∈ {"FA", "SA", …} — resolved against the catalog when it's loaded. */
  private mkSlot(label: string, typeKey: string, term: string, rawMax: number, weightMax: number): Slot {
    return {
      key: this.slugify(label),
      label,
      typeId: this.resolveTypeIdFromKind(typeKey),
      term, rawMax, weightMax,
      passingMarks: this.defaultSlotPass(rawMax),
      subjectOverrides: [],
      components: null,
      ownRawMax: null,
      pullForward: null,
      includeInGrandTotal: true,
      subjectConfigs: null,
    };
  }

  /** Union of every component label used across this scheme's subjects —
   *  pulled from the Subject.components definitions when the scheme fetch
   *  resolves. Falls back to COMMON_COMPONENT_LABELS when nothing is loaded
   *  so a fresh scheme still has suggestions. */
  get schemeComponentLabelUniverse(): string[] {
    const seen = new Set<string>();
    for (const s of this.schemeSubjects || []) {
      for (const l of s.componentLabels || []) {
        const t = (l || '').trim();
        if (t) seen.add(t);
      }
    }
    if (seen.size === 0) return [...this.COMMON_COMPONENT_LABELS];
    return [...seen].sort((a, b) => a.localeCompare(b));
  }

  /** Autocomplete suggestions for one slot's component Label — filtered by
   *  the current typed value (case-insensitive substring). Prepends the
   *  current value when it isn't an exact match so admins see what they
   *  typed appears committed. */
  componentLabelSuggestions(current: string | null | undefined): string[] {
    const typed = (current || '').trim().toLowerCase();
    const pool = this.schemeComponentLabelUniverse;
    if (!typed) return pool;
    return pool.filter(opt => opt.toLowerCase().includes(typed));
  }

  /**
   * FA preset for SSLC: 50 raw as ONE component ("Theory") split into 3 sub-parts
   * (Paper 1: 15 + Paper 2: 15 + Activity: 20). The component key stays generic
   * "theory" so it resolves against most subjects; admin can repick in the UI.
   * includeInGrandTotal=false because SSLC FAs feed SAs via pull-forward —
   * counting them separately would double-count the same marks.
   */
  private mkFaWithComponents(label: string, term: string): Slot {
    const s = this.mkSlot(label, 'FA', term, 50, 50);
    s.components = [{
      key: 'theory',
      label: 'Theory',
      maxMarks: 50,
      passingMarks: this.defaultComponentPass(50),
      subComponents: [
        { key: 'paper1',   label: 'Paper 1',  maxMarks: 15, passingMarks: this.defaultComponentPass(15) },
        { key: 'paper2',   label: 'Paper 2',  maxMarks: 15, passingMarks: this.defaultComponentPass(15) },
        { key: 'activity', label: 'Activity', maxMarks: 20, passingMarks: this.defaultComponentPass(20) },
      ],
    }];
    s.includeInGrandTotal = false;
    return s;
  }

  /**
   * SA preset for SSLC: paper is conducted for 80 marks (rawMax=80, no
   * reduction by default so weightMax=80), then 20 pulled from earlier
   * FAs. Grand-total contribution = 80 (weighted) + 20 (pulled) = 100.
   * The school can lower weightMax (e.g. to 70) if they want to further
   * reduce the paper portion.
   */
  private mkSaWithPull(label: string, term: string, fromKeys: string[], includeInGrand: boolean): Slot {
    const s = this.mkSlot(label, 'SA', term, 80, 80);
    s.pullForward = { fromSlotKeys: [...fromKeys], contributionMax: 20 };
    s.includeInGrandTotal = includeInGrand;
    return s;
  }

  private slugify(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private blankForm(): SchemeForm {
    return {
      name: '',
      displayOrder: 1,
      defaultMaxMarks: null,
      description: '',
      applicableClassIds: [],
      slots: [],
      academicYearId: null,
      passingPercent: 35,
    };
  }

  // ── Slot editor ──────────────────────────────────────────────────────

  addSlot(): void {
    const label = `Slot ${this.form.slots.length + 1}`;
    const slot = this.mkSlot(label, 'FA', '', 20, 10);
    this.form.slots = [...this.form.slots, slot];
  }

  addSlotFrom(preset: 'FA' | 'SA'): void {
    const presetId = this.typeByKey(preset)?.id;
    const count = this.form.slots.filter(s => s.typeId === presetId).length + 1;
    const label = `${preset}${count}`;
    const slot = preset === 'SA' ? this.mkSlot(label, 'SA', '', 50, 30) : this.mkSlot(label, 'FA', '', 20, 10);
    this.form.slots = [...this.form.slots, slot];
  }

  removeSlot(idx: number): void {
    this.form.slots = this.form.slots.filter((_, i) => i !== idx);
  }

  moveSlot(idx: number, dir: -1 | 1): void {
    const target = idx + dir;
    if (target < 0 || target >= this.form.slots.length) return;
    const next = [...this.form.slots];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    this.form.slots = next;
  }

  applyPreset(preset: { name: string; slots: Slot[]; description: string }): void {
    if (!this.form.name?.trim()) this.form.name = preset.name;
    if (!this.form.description?.trim()) this.form.description = preset.description;
    // Deep clone — presets are class-level readonly values; a shallow spread
    // leaves `components`, `pullForward`, and `subjectOverrides` sharing
    // references, so edits leak back and a second apply hands back mutated
    // defaults.
    this.form.slots = preset.slots.map(s => ({
      ...s,
      subjectOverrides: [],
      components: s.components ? s.components.map(c => ({
        ...c,
        subComponents: c.subComponents ? c.subComponents.map(sc => ({ ...sc })) : null,
      })) : null,
      pullForward: s.pullForward ? {
        fromSlotKeys: [...s.pullForward.fromSlotKeys],
        contributionMax: s.pullForward.contributionMax,
      } : null,
    }));
    // Presets are built at class-construct time before the catalog loads, so
    // every slot lands with a blank typeId. Resolve each now against the live
    // catalog using the slot label (FA1 → FA, SA2 → SA).
    this.applyDefaultTypeIdWhereMissing();
  }

  // ── Components (sub-pieces that sum to rawMax) ───────────────────────

  hasComponents(slot: Slot): boolean { return slot.components != null; }

  toggleComponents(slot: Slot, on: boolean): void {
    if (on) {
      // Seed the first available subject component so the sum validates
      // immediately. If no subject components are loaded yet, seed an
      // empty placeholder that admin must pick a key for.
      const avail = this.availableComponentDefsForSlot(slot);
      const seed = avail[0];
      const max = slot.rawMax;
      slot.components = [{
        key: seed?.key || '',
        label: seed?.label || '',
        maxMarks: max,
        passingMarks: this.defaultComponentPass(max),
        subComponents: null,
      }];
    } else {
      slot.components = null;
    }
  }

  /** Memoized pool of every (key,label) component def across the scheme's
   *  subjects — invalidated only when the subjects reference changes. Called
   *  from template every change-detection pass, so returning a NEW array each
   *  time would thrash Angular (we saw "page unresponsive" dialogs). */
  private _allDefsCache: { key: string; label: string }[] = [];
  private _allDefsForRef: SchemeSubject[] | null = null;
  allComponentDefsForScheme(): { key: string; label: string }[] {
    if (this._allDefsForRef === this.schemeSubjects) return this._allDefsCache;
    const pool = new Map<string, string>();
    for (const sub of this.schemeSubjects || []) {
      for (const d of sub.componentDefs || []) {
        if (d.key && !pool.has(d.key)) pool.set(d.key, d.label);
      }
    }
    this._allDefsCache = Array.from(pool.entries()).map(([key, label]) => ({ key, label }));
    this._allDefsForRef = this.schemeSubjects;
    return this._allDefsCache;
  }

  /** Pool minus the component keys already added to THIS slot. Cached per
   *  slot keyed on (slot ref, components length, components key-join) so a
   *  single template cycle doesn't rebuild the array dozens of times. */
  private _availForSlotCache = new WeakMap<Slot, { sig: string; defs: { key: string; label: string }[] }>();
  availableComponentDefsForSlot(slot: Slot): { key: string; label: string }[] {
    const all = this.allComponentDefsForScheme();
    const usedKeys = (slot.components || []).map(c => c.key).filter(k => !!k);
    const sig = (this._allDefsForRef === this.schemeSubjects ? '1' : '0') + '|' + usedKeys.join(',');
    const prev = this._availForSlotCache.get(slot);
    if (prev && prev.sig === sig) return prev.defs;
    const used = new Set(usedKeys);
    const defs = all.filter(d => !used.has(d.key));
    this._availForSlotCache.set(slot, { sig, defs });
    return defs;
  }

  addComponent(slot: Slot): void {
    const list = slot.components || [];
    const avail = this.availableComponentDefsForSlot(slot);
    const pick = avail[0];
    slot.components = [...list, {
      key: pick?.key || '',
      label: pick?.label || '',
      maxMarks: 0,
      passingMarks: 0,
      subComponents: null,
    }];
  }

  removeComponent(slot: Slot, idx: number): void {
    if (!slot.components) return;
    slot.components = slot.components.filter((_, i) => i !== idx);
    if (slot.components.length === 0) slot.components = null;
  }

  /** Admin changed a component's key via the picker — refresh the label from
   *  the pool so it stays in sync. */
  onComponentKeyChanged(c: SlotComponent): void {
    const def = this.allComponentDefsForScheme().find(d => d.key === c.key);
    if (def) c.label = def.label;
  }

  componentsSum(slot: Slot): number {
    return (slot.components || []).reduce((s, c) => s + (Number(c.maxMarks) || 0), 0);
  }

  componentsMatchRaw(slot: Slot): boolean {
    if (!slot.components?.length) return true;
    return Math.abs(this.componentsSum(slot) - (Number(slot.rawMax) || 0)) < 0.0001;
  }

  // ── Sub-components (per-slot split UNDER a component) ─────────────────

  hasSubComponents(c: SlotComponent): boolean {
    return !!(c.subComponents && c.subComponents.length > 0);
  }

  addSubComponent(c: SlotComponent): void {
    const list = c.subComponents || [];
    const idx = list.length + 1;
    c.subComponents = [...list, {
      key: `sc${idx}`,
      label: `Part ${idx}`,
      maxMarks: 0,
      passingMarks: 0,
    }];
  }

  removeSubComponent(c: SlotComponent, idx: number): void {
    if (!c.subComponents) return;
    c.subComponents = c.subComponents.filter((_, i) => i !== idx);
    if (c.subComponents.length === 0) c.subComponents = null;
  }

  subComponentsSum(c: SlotComponent): number {
    return (c.subComponents || []).reduce((s, sc) => s + (Number(sc.maxMarks) || 0), 0);
  }

  subComponentsMatchComponent(c: SlotComponent): boolean {
    if (!this.hasSubComponents(c)) return true;
    return Math.abs(this.subComponentsSum(c) - (Number(c.maxMarks) || 0)) < 0.0001;
  }

  /** ngModelChange on a sub-part's maxMarks — recomputes its pass default. */
  onSubComponentMaxChanged(sc: SlotSubComponent): void {
    sc.passingMarks = this.defaultComponentPass(sc.maxMarks);
  }

  // ── Pull-forward (SA borrows marks from earlier FAs) ─────────────────

  hasPullForward(slot: Slot): boolean { return slot.pullForward != null; }

  togglePullForward(slot: Slot, on: boolean): void {
    if (on) {
      slot.pullForward = { fromSlotKeys: [], contributionMax: 0 };
    } else {
      slot.pullForward = null;
    }
    slot.ownRawMax = null;  // legacy field — never used after the redesign
  }

  /**
   * Grand-total contribution of a slot = reduced-paper weighted + pulled.
   * Equals weightMax when there is no pull. The paper's own reduction
   * (raw → weighted) stays the normal flow; pulled stacks on top.
   */
  slotContribution(slot: Slot): number {
    const w = Number(slot.weightMax) || 0;
    const pulled = slot.pullForward ? (Number(slot.pullForward.contributionMax) || 0) : 0;
    return w + pulled;
  }

  /** Kept so templates compile; now returns the slot's grand-total contribution. */
  effectiveTotal(slot: Slot): number {
    return this.slotContribution(slot);
  }

  /** Earlier slots this slot can pull from (position-based). */
  earlierSlotsFor(idx: number): Slot[] {
    return this.form.slots.slice(0, idx);
  }

  slotLabelByKey(key: string): string {
    const s = this.form.slots.find(x => x.key === key);
    return s ? s.label : key;
  }

  /** Pull is OK when there's at least one source and a positive contribution. */
  pullMathOk(slot: Slot): boolean {
    if (!slot.pullForward) return true;
    return (slot.pullForward.fromSlotKeys?.length ?? 0) > 0
        && (Number(slot.pullForward.contributionMax) || 0) > 0;
  }

  // ── Per-slot subject table (Phase 2 primary roster) ──────────────────

  /**
   * Fetches unique subjects for the scheme's applicable classes (+ their core
   * flag) from the backend. Falls back to class-by-class SubjectService calls
   * on create when the scheme has no id yet. Cached in {@link schemeSubjects}
   * so the slot table renders synchronously.
   */
  private loadSchemeSubjects(): void {
    this.schemeSubjectsLoaded = false;
    if (this.isEditing && this.schemeId) {
      // Edit mode — backend endpoint already knows the scheme's classes.
      this.api.getSubjectsForScheme(this.schemeId).subscribe({
        next: (res: any) => {
          this.schemeSubjects = (res?.data || []).map((s: any) => ({
            subjectId: s.subjectId,
            name: s.name,
            coreSubject: !!s.coreSubject,
            classNames: Array.isArray(s.classNames) ? s.classNames : [],
            componentLabels: Array.isArray(s.componentLabels) ? s.componentLabels : [],
            componentDefs: Array.isArray(s.componentDefs)
              ? s.componentDefs.map((d: any) => ({ key: d.key, label: d.label }))
              : [],
          }));
          this.schemeSubjectsLoaded = true;
        },
        error: () => { this.schemeSubjects = []; this.schemeSubjectsLoaded = true; },
      });
      return;
    }
    // Create mode: no schemeId yet. Union subjects across picked class ids.
    const yearId = this.form.academicYearId;
    const classIds = this.form.applicableClassIds || [];
    if (!yearId || classIds.length === 0) {
      this.schemeSubjects = [];
      this.schemeSubjectsLoaded = true;
      return;
    }
    const seen = new Map<string, SchemeSubject>();
    let pending = classIds.length;
    for (const cid of classIds) {
      const className = this.classes.find(c => c.classId === cid)?.name || cid;
      this.subjectService.getSubjectsByClassAndYear(cid, yearId).subscribe({
        next: (subs) => {
          for (const s of subs) {
            let row = seen.get(s.subjectId);
            if (!row) {
              row = {
                subjectId: s.subjectId,
                name: s.name,
                coreSubject: (s as any).coreSubject == null ? true : !!(s as any).coreSubject,
                classNames: [],
                componentLabels: [],
                componentDefs: [],
              };
              seen.set(s.subjectId, row);
            }
            if (!row.classNames.includes(className)) row.classNames.push(className);
            // Union component labels + full (key,label) defs across this subject's
            // class occurrences — defs feed the scheme slot's component picker.
            const compList: any[] = Array.isArray((s as any).components) ? (s as any).components : [];
            const defKeys = new Set(row.componentDefs.map(d => d.key));
            for (const comp of compList) {
              const lbl = (comp?.label || '').trim();
              const ckey = (comp?.key || '').trim();
              if (lbl && !row.componentLabels.includes(lbl)) row.componentLabels.push(lbl);
              if (ckey && !defKeys.has(ckey)) {
                row.componentDefs.push({ key: ckey, label: lbl });
                defKeys.add(ckey);
              }
            }
          }
        },
        complete: () => {
          if (--pending === 0) {
            for (const row of seen.values()) {
              row.classNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            }
            this.schemeSubjects = Array.from(seen.values())
              .sort((a, b) => (a.coreSubject === b.coreSubject
                ? a.name.localeCompare(b.name)
                : (a.coreSubject ? -1 : 1)));
            this.schemeSubjectsLoaded = true;
          }
        },
      });
    }
  }

  /** "Sanskrit (1st, 2nd)" — appends the class list when non-empty. */
  subjectDisplayName(id: string): string {
    const s = this.schemeSubjects.find(x => x.subjectId === id);
    if (!s) return this.subjectService.getSubjectName(id);
    return s.classNames.length > 0 ? `${s.name} (${s.classNames.join(', ')})` : s.name;
  }

  subjectName(id: string): string {
    const s = this.schemeSubjects.find(x => x.subjectId === id);
    return s ? s.name : this.subjectService.getSubjectName(id);
  }

  isSubjectCore(id: string): boolean {
    const s = this.schemeSubjects.find(x => x.subjectId === id);
    return s ? s.coreSubject : true;
  }

  /** Subjects not yet in this slot's roster — used by the "Add" dropdown. */
  availableSubjectsForSlot(slot: Slot): SchemeSubject[] {
    const used = new Set((slot.subjectConfigs || []).map(c => c.subjectId));
    return this.schemeSubjects.filter(s => !used.has(s.subjectId));
  }

  /** Row-shaped from the slot's current defaults — the single seed path.
   *  Pass is a % of RAW (what teachers actually evaluate the paper out of);
   *  weighted/pulled are grand-total scaling, not pass-bar inputs. */
  private mkConfigFromSlot(slot: Slot, subjectId: string): SubjectConfig {
    const pulled = slot.pullForward ? slot.pullForward.contributionMax : null;
    return {
      subjectId,
      rawMax: slot.rawMax,
      weightMax: slot.weightMax,
      passingMarks: this.defaultSlotPass(slot.rawMax),
      pulledContributionMax: pulled,
    };
  }

  /** Total marks for one subject row — weighted plus any pulled contribution.
   *  Reactive by design (used in the template) so edits to weight / pulled
   *  update the displayed Total column live. */
  rowTotal(c: SubjectConfig, slot: Slot): number {
    const weight = Number(c.weightMax) || 0;
    if (!slot.pullForward) return weight;
    const pulled = c.pulledContributionMax == null
      ? (Number(slot.pullForward.contributionMax) || 0)
      : (Number(c.pulledContributionMax) || 0);
    return weight + pulled;
  }

  /** Fills the slot's roster from core subjects. If roster already has rows,
   *  only adds missing core subjects without wiping manual edits. */
  seedSubjectsForSlot(slot: Slot): void {
    const existing = new Set((slot.subjectConfigs || []).map(c => c.subjectId));
    const seeded: SubjectConfig[] = [];
    for (const s of this.schemeSubjects) {
      if (!s.coreSubject) continue;
      if (existing.has(s.subjectId)) continue;
      seeded.push(this.mkConfigFromSlot(slot, s.subjectId));
    }
    slot.subjectConfigs = [...(slot.subjectConfigs || []), ...seeded];
  }

  /** Nuke the slot's roster back to null so rollout falls back to legacy. */
  clearSubjectsForSlot(slot: Slot): void {
    slot.subjectConfigs = null;
  }

  addSubjectToSlot(slot: Slot, subjectId: string): void {
    if (!subjectId) return;
    slot.subjectConfigs = [
      ...(slot.subjectConfigs || []),
      this.mkConfigFromSlot(slot, subjectId),
    ];
  }

  removeSubjectFromSlot(slot: Slot, idx: number): void {
    if (!slot.subjectConfigs) return;
    slot.subjectConfigs = slot.subjectConfigs.filter((_, i) => i !== idx);
    if (slot.subjectConfigs.length === 0) slot.subjectConfigs = null;
  }

  /** Overwrites every row's raw/weighted/pass/pulled with the slot's current
   *  defaults — handy after the admin edits slot-level values. */
  resetSubjectRowsForSlot(slot: Slot): void {
    if (!slot.subjectConfigs?.length) return;
    for (const c of slot.subjectConfigs) {
      c.rawMax = slot.rawMax;
      c.weightMax = slot.weightMax;
      c.passingMarks = slot.passingMarks;
      c.pulledContributionMax = slot.pullForward ? slot.pullForward.contributionMax : null;
    }
  }

  // (Subject-level overrides UI has been folded into the per-slot
  // subjectConfigs roster above — see "Subjects for this slot".)

  // ── Clone to same-kind siblings ──────────────────────────────────────

  /**
   * FA/SA slots usually repeat the same shape (FA1..FA4 all = 50 raw with 15+15+20
   * components). Clone copies raw/weighted/passing/components/count-flag AND the
   * per-slot subject rows AND pull-forward contribution (keeping each slot's own
   * pull-source list — SA1 pulls from [fa1,fa2], SA2 from [fa1..fa4]). Each
   * slot keeps its own label/term/pull-source list so FA1(Term 1) stays
   * FA1(Term 1).
   */
  cloneToSameKind(source: Slot): void {
    let changed = 0;
    for (const target of this.form.slots) {
      if (target === source || target.typeId !== source.typeId) continue;
      target.rawMax = Number(source.rawMax) || 0;
      target.weightMax = Number(source.weightMax) || 0;
      target.passingMarks = source.passingMarks;
      target.includeInGrandTotal = source.includeInGrandTotal;
      target.components = source.components
        ? source.components.map(c => ({
            ...c,
            subComponents: c.subComponents ? c.subComponents.map(sc => ({ ...sc })) : null,
          }))
        : null;
      // Per-slot subject roster — deep clone so edits on target don't bleed
      // back into source.
      target.subjectConfigs = source.subjectConfigs
        ? source.subjectConfigs.map(c => ({ ...c }))
        : null;
      // Pull-forward: propagate the "shape" (on/off + contributionMax) but keep
      // the target's own fromSlotKeys. SAs typically pull from DIFFERENT prior
      // slots (SA1 from fa1+fa2, SA2 from fa1..fa4), so overwriting the source
      // list would almost always be wrong.
      if (source.pullForward && target.pullForward) {
        target.pullForward.contributionMax = source.pullForward.contributionMax;
      } else if (source.pullForward && !target.pullForward) {
        target.pullForward = {
          fromSlotKeys: [],       // admin picks sources per target
          contributionMax: source.pullForward.contributionMax,
        };
      } else if (!source.pullForward && target.pullForward) {
        target.pullForward = null;
      }
      changed++;
    }
    const label = this.typeNameFor(source.typeId);
    if (changed === 0) {
      this.snackBar.open(`No other ${label} slots to copy to`, 'Close', { duration: 2500 });
    } else {
      this.snackBar.open(
        `Copied this config to ${changed} other ${label} slot(s)` +
        (source.pullForward ? ' — review pull-forward sources per slot' : ''),
        'Close', { duration: 3500 },
      );
    }
  }

  sameKindCount(source: Slot): number {
    return this.form.slots.filter(s => s !== source && s.typeId === source.typeId).length;
  }

  // ── Grand-total scope (bulk include/exclude) ─────────────────────────

  /**
   * Scope presets flip every slot's includeInGrandTotal in one click. "custom"
   * means the admin has fiddled per-slot and no scope preset matches the
   * current state.
   */
  readonly scopeOptions: { key: 'all' | 'sas' | 'finalSa' | 'custom'; label: string; hint: string }[] = [
    { key: 'all',     label: 'All slots count',   hint: 'Every slot contributes to the grand total (1st–8th style).' },
    { key: 'sas',     label: 'SAs only',           hint: 'Count every SA; skip FAs (useful when SAs already pull from FAs).' },
    { key: 'finalSa', label: 'Only the final SA',  hint: 'Count only the last SA (SSLC — SA2 already pulls from every FA).' },
    { key: 'custom',  label: 'Custom',             hint: 'Keep whatever each slot has — set the toggles yourself.' },
  ];

  get currentScope(): 'all' | 'sas' | 'finalSa' | 'custom' {
    const slots = this.form.slots || [];
    if (slots.length === 0) return 'all';
    const allOn = slots.every(s => s.includeInGrandTotal !== false);
    if (allOn) return 'all';
    const sasOnly = slots.every(s => this.isSaSlot(s) === (s.includeInGrandTotal !== false));
    if (sasOnly) return 'sas';
    const lastSaIdx = this.lastSaIndex();
    if (lastSaIdx >= 0) {
      const finalOnly = slots.every((s, i) => (i === lastSaIdx) === (s.includeInGrandTotal !== false));
      if (finalOnly) return 'finalSa';
    }
    return 'custom';
  }

  private lastSaIndex(): number {
    let found = -1;
    this.form.slots.forEach((s, i) => { if (this.isSaSlot(s)) found = i; });
    return found;
  }

  applyScope(key: 'all' | 'sas' | 'finalSa' | 'custom'): void {
    if (key === 'custom') return;  // leave as-is; user drives it
    const slots = this.form.slots || [];
    if (key === 'all') {
      slots.forEach(s => s.includeInGrandTotal = true);
      return;
    }
    if (key === 'sas') {
      slots.forEach(s => s.includeInGrandTotal = this.isSaSlot(s));
      return;
    }
    if (key === 'finalSa') {
      const idx = this.lastSaIndex();
      if (idx < 0) {
        this.snackBar.open('No SA slot found to count as the final one', 'Close', { duration: 3000 });
        return;
      }
      slots.forEach((s, i) => s.includeInGrandTotal = i === idx);
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────

  get grandRaw(): number {
    // "Paper total" — sum of papers teachers actually conduct, across ALL
    // slots. Off-total slots (FAs that feed SAs via pull) still produce
    // papers the teacher runs, so they belong here even though they don't
    // land in the grand total.
    return this.form.slots.reduce((sum, s) => sum + (Number(s.rawMax) || 0), 0);
  }
  get grandWeight(): number {
    // Grand total = each counted slot's reduced-paper weighted + its pulled
    // contribution. Off-total slots are skipped — they contribute via the
    // SA that pulls them.
    return this.form.slots
      .filter(s => s.includeInGrandTotal !== false)
      .reduce((sum, s) => sum + this.slotContribution(s), 0);
  }
  get excludedCount(): number {
    return this.form.slots.filter(s => s.includeInGrandTotal === false).length;
  }

  // (kindMeta removed — color/label now resolved via typeById against the
  //  loaded catalog; see typeNameFor() / typeColorFor().)

  // ── Save / cancel ────────────────────────────────────────────────────

  save(): void {
    const name = (this.form.name || '').trim();
    if (!name) {
      this.snackBar.open('Scheme name is required', 'Close', { duration: 2500 });
      return;
    }
    if (!this.form.academicYearId) {
      this.snackBar.open('Academic year is required', 'Close', { duration: 2500 });
      return;
    }
    if (!this.form.applicableClassIds || this.form.applicableClassIds.length === 0) {
      this.snackBar.open('Pick at least one applicable class', 'Close', { duration: 3000 });
      return;
    }
    if (this.form.slots.length === 0) {
      this.snackBar.open('Add at least one slot', 'Close', { duration: 2500 });
      return;
    }
    for (const s of this.form.slots) {
      if (!s.label?.trim()) {
        this.snackBar.open('Every slot needs an exam name', 'Close', { duration: 2500 });
        return;
      }
      if (!s.typeId) {
        this.snackBar.open(`Slot "${s.label}": pick an exam type`, 'Close', { duration: 3000 });
        return;
      }
      if (!s.subjectConfigs || s.subjectConfigs.length === 0) {
        this.snackBar.open(`Slot "${s.label}": add at least one subject`, 'Close', { duration: 3000 });
        return;
      }
      if (!(s.rawMax > 0) || !(s.weightMax > 0)) {
        this.snackBar.open(`Slot "${s.label}": raw and weighted must be > 0`, 'Close', { duration: 3000 });
        return;
      }
      if (s.weightMax > s.rawMax) {
        this.snackBar.open(`Slot "${s.label}": weighted can't exceed raw`, 'Close', { duration: 3000 });
        return;
      }
      if (s.components?.length && !this.componentsMatchRaw(s)) {
        this.snackBar.open(
          `Slot "${s.label}": components sum to ${this.componentsSum(s)} but raw is ${s.rawMax}`,
          'Close', { duration: 3500 });
        return;
      }
      if (s.components?.length) {
        for (const c of s.components) {
          if (!c.key) {
            this.snackBar.open(
              `Slot "${s.label}": every component must be picked from the subject's components`,
              'Close', { duration: 3500 });
            return;
          }
          if (this.hasSubComponents(c) && !this.subComponentsMatchComponent(c)) {
            this.snackBar.open(
              `Slot "${s.label}" / ${c.label}: sub-parts sum to ${this.subComponentsSum(c)} but component max is ${c.maxMarks}`,
              'Close', { duration: 3500 });
            return;
          }
        }
      }
      if (s.pullForward) {
        if (!s.pullForward.fromSlotKeys.length) {
          this.snackBar.open(`Slot "${s.label}": pull-forward needs at least one source slot`, 'Close', { duration: 3000 });
          return;
        }
        if (!(s.pullForward.contributionMax > 0)) {
          this.snackBar.open(`Slot "${s.label}": pulled contribution must be > 0`, 'Close', { duration: 3000 });
          return;
        }
      }
      if (s.subjectConfigs?.length) {
        const ids = new Set<string>();
        for (const c of s.subjectConfigs) {
          if (!c.subjectId) {
            this.snackBar.open(`Slot "${s.label}": a subject row is missing its subject`, 'Close', { duration: 3000 });
            return;
          }
          if (ids.has(c.subjectId)) {
            this.snackBar.open(`Slot "${s.label}": "${this.subjectName(c.subjectId)}" appears twice`, 'Close', { duration: 3000 });
            return;
          }
          ids.add(c.subjectId);
          if (!(c.rawMax > 0) || !(c.weightMax > 0) || c.weightMax > c.rawMax) {
            this.snackBar.open(`Slot "${s.label}": "${this.subjectName(c.subjectId)}" needs valid raw & weighted (weighted ≤ raw)`, 'Close', { duration: 3500 });
            return;
          }
        }
      }
    }

    this.isSaving = true;
    const payload: any = {
      name,
      displayOrder: Number(this.form.displayOrder) || 1,
      defaultMaxMarks: this.form.defaultMaxMarks == null || (this.form.defaultMaxMarks as any) === ''
        ? null
        : Number(this.form.defaultMaxMarks),
      description: (this.form.description || '').trim() || null,
      applicableClassIds: this.form.applicableClassIds || [],
      academicYearId: this.form.academicYearId || null,
      passingPercent: Number(this.form.passingPercent) || 35,
      slots: this.form.slots.length === 0 ? null : this.form.slots.map(s => ({
        key: s.key || null,
        label: s.label,
        typeId: s.typeId || null,
        term: s.term || null,
        rawMax: Number(s.rawMax),
        weightMax: Number(s.weightMax),
        passingMarks: s.passingMarks == null ? null : Number(s.passingMarks),
        // Legacy field — always empty going forward. The single surface for
        // per-subject tuning is subjectConfigs below.
        subjectOverrides: [],
        // Phase 2 extras — null when unused keeps old scheme shape unchanged.
        components: !s.components?.length ? null : s.components.map(c => ({
          key: c.key || null,
          label: c.label,
          maxMarks: Number(c.maxMarks),
          passingMarks: c.passingMarks == null ? null : Number(c.passingMarks),
          subComponents: !c.subComponents?.length ? null : c.subComponents.map(sc => ({
            key: sc.key || null,
            label: sc.label,
            maxMarks: Number(sc.maxMarks),
            passingMarks: sc.passingMarks == null ? null : Number(sc.passingMarks),
          })),
        })),
        // Legacy field — redesign stopped using it. Always null going forward.
        ownRawMax: null,
        pullForward: !s.pullForward ? null : {
          fromSlotKeys: [...s.pullForward.fromSlotKeys],
          contributionMax: Number(s.pullForward.contributionMax),
        },
        includeInGrandTotal: s.includeInGrandTotal,
        subjectConfigs: !s.subjectConfigs?.length ? null : s.subjectConfigs.map(c => ({
          subjectId: c.subjectId,
          rawMax: Number(c.rawMax),
          weightMax: Number(c.weightMax),
          passingMarks: c.passingMarks == null ? null : Number(c.passingMarks),
          pulledContributionMax: (s.pullForward && c.pulledContributionMax != null)
            ? Number(c.pulledContributionMax)
            : null,
        })),
      })),
    };

    const req$ = this.isEditing && this.schemeId
      ? this.api.updateExamScheme(this.schemeId, payload)
      : this.api.createExamScheme(payload);
    req$.subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open(this.isEditing ? 'Scheme updated' : 'Scheme created', 'Close', { duration: 2500 });
        this.router.navigate(['/exam-types']);
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save', 'Close', { duration: 4000 });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/exam-types']);
  }
}
