import { Component, OnInit } from '@angular/core';
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
    PageHeaderComponent,
  ],
  templateUrl: './subjects-list.component.html',
  styleUrl: './subjects-list.component.scss',
})
export class SubjectsListComponent implements OnInit {
  // Renamed "type" column to "summary" — shows component count + makeup
  // so the same column works for legacy single-type subjects AND new
  // component-shaped subjects.
  displayedColumns: string[] = ['name', 'code', 'summary', 'actions'];
  dataSource = new MatTableDataSource<SubjectItem>([]);
  isLoading = false;

  createDialogOpen = false;
  isCreating = false;
  form!: FormGroup;

  classes: Array<{ classId: string; name: string }> = [];
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

  ngOnInit(): void {
    this.loadSubjects();
    this.loadClassesAndYears();
    this.buildForm();
  }

  // ── Form construction ──────────────────────────────────────────────

  /**
   * Build the reactive form with a FormArray of components.
   *
   * Starts with one default Theory component so the "create a simple
   * subject" path stays one-click. Admin clicks "Add component" to
   * append a Practical / Internal / Project block when needed.
   */
  private buildForm(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      classId: ['', Validators.required],
      academicYearId: ['', Validators.required],
      passRule: ['PER_COMPONENT', Validators.required],
      components: this.fb.array([this.buildComponentGroup('theory', 'Theory', 100, 35, true, 'EXAM')]),
    });
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
    this.apiService.getAcademicYears().subscribe({
      next: r => { this.academicYears = (r as any)?.data ?? []; },
    });
    this.apiService.getClasses().subscribe({
      next: r => { this.classes = ((r as any)?.data ?? []).map((c: any) => ({ classId: c.classId, name: c.name })); },
    });
  }

  // ── Dialog open / close ────────────────────────────────────────────

  openCreateDialog(): void {
    this.buildForm();
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
    const v = this.form.value as CreateOrUpdateSubject;
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
