import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { BiometricTerminalBinding, SchoolClass, Student } from '../../../core/models';

@Component({
  selector: 'app-terminal-bindings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './terminal-bindings.component.html',
  styleUrl: './terminal-bindings.component.scss',
})
export class TerminalBindingsComponent implements OnInit {

  serial = '';
  bindings: BiometricTerminalBinding[] = [];
  isLoading = false;
  displayedColumns = ['terminalUserId', 'student', 'className', 'boundAt', 'actions'];

  // Add-binding form state — class → section → student flow.
  newTerminalUserId = '';
  classes: SchoolClass[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  /** Sections for the currently-picked class — cached on class change so
   *  mat-select doesn't see a fresh array on every change-detection tick. */
  sections: { sectionId: string; name: string }[] = [];
  students: Student[] = [];
  /** Free-text the admin types into the student autocomplete. Kept as
   *  ngModel of the input; picking an option overwrites it with the
   *  chosen student's label and stamps {@link selectedStudent}. */
  studentSearch = '';
  selectedStudent: Student | null = null;
  isLoadingStudents = false;
  isBinding = false;

  // Delete confirm
  toRemove: BiometricTerminalBinding | null = null;
  isRemoving = false;

  // Inline edit — one row at a time. The row identity is
  // {@code terminalUserId} (unique per SN) so the current-editing key
  // acts as both "is this row editing" and "what was the old value".
  editingTuid: string | null = null;
  editedTuidValue = '';
  isSavingEdit = false;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.serial = this.route.snapshot.paramMap.get('serial') || '';
    this.load();
    this.api.getClasses().subscribe({
      next: (res) => { if (res?.success && res.data) this.classes = res.data; },
    });
  }

  load(): void {
    if (!this.serial) return;
    this.isLoading = true;
    this.api.listBiometricTerminalBindings(this.serial).subscribe({
      next: (res) => {
        this.bindings = res?.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load bindings', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Class / section / student cascade ────────────────────────────

  onClassChange(): void {
    this.selectedSectionId = '';
    this.resetStudentPick();
    this.students = [];
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = ((cls?.sections as any[]) || []).map(s => ({
      sectionId: s.sectionId, name: s.name,
    }));
    this.loadStudents();
  }

  onSectionChange(): void {
    this.resetStudentPick();
    this.loadStudents();
  }

  private resetStudentPick(): void {
    this.selectedStudent = null;
    this.studentSearch = '';
  }

  private loadStudents(): void {
    if (!this.selectedClassId) { this.students = []; return; }
    this.isLoadingStudents = true;
    const filters: any = { classId: this.selectedClassId };
    if (this.selectedSectionId) filters.sectionId = this.selectedSectionId;
    this.api.getStudents(0, 500, filters).subscribe({
      next: (res) => {
        const list = (res?.data as any)?.content || res?.data || [];
        // Sort by roll number when present, fall back to name — the
        // teacher / admin can scan the list quickly the same way the
        // paper class roster does.
        this.students = [...list].sort((a: any, b: any) => {
          const ar = parseInt(a.rollNumber || '', 10);
          const br = parseInt(b.rollNumber || '', 10);
          if (!isNaN(ar) && !isNaN(br)) return ar - br;
          return this.displayStudent(a).localeCompare(this.displayStudent(b));
        });
        this.isLoadingStudents = false;
      },
      error: () => {
        this.students = [];
        this.isLoadingStudents = false;
      },
    });
  }

  displayStudent(s: Student | null | undefined): string {
    if (!s) return '';
    const first = s.firstName || '';
    const last = s.lastName || '';
    const name = (first + ' ' + last).trim();
    if (name) return name;
    if (s.admissionNumber) return `Adm ${s.admissionNumber}`;
    return s.studentId;
  }

  studentOptionLabel(s: Student): string {
    const roll = s.rollNumber ? `Roll ${s.rollNumber} · ` : '';
    const adm = s.admissionNumber ? ` (${s.admissionNumber})` : '';
    return `${roll}${this.displayStudent(s)}${adm}`;
  }

  /** Client-side filter over the already-loaded class/section student
   *  list. Matches on name, admission number and roll — one keystroke
   *  narrows across all three, no debounce needed since the list is
   *  small (~40 kids per section). */
  get filteredStudents(): Student[] {
    const q = (this.studentSearch || '').trim().toLowerCase();
    if (!q) return this.students;
    return this.students.filter(s => {
      const name = this.displayStudent(s).toLowerCase();
      const adm = (s.admissionNumber || '').toLowerCase();
      const roll = (s.rollNumber || '').toString().toLowerCase();
      return name.includes(q) || adm.includes(q) || roll.includes(q);
    });
  }

  onStudentPicked(event: MatAutocompleteSelectedEvent): void {
    this.selectedStudent = event.option.value as Student;
    this.studentSearch = this.studentOptionLabel(this.selectedStudent);
  }

  /** Called when the user clears the input or edits after selecting —
   *  drop the previously-picked student so Bind stays disabled until a
   *  fresh pick lands. */
  onStudentSearchChange(): void {
    if (!this.selectedStudent) return;
    const currentLabel = this.studentOptionLabel(this.selectedStudent);
    if (this.studentSearch !== currentLabel) this.selectedStudent = null;
  }

  // ── Submit / remove ──────────────────────────────────────────────

  submitBinding(): void {
    if (!this.newTerminalUserId.trim() || !this.selectedStudent) return;
    this.isBinding = true;
    this.api.bindBiometricTerminalUser(this.serial, {
      terminalUserId: this.newTerminalUserId.trim(),
      studentId: this.selectedStudent.studentId,
    }).subscribe({
      next: () => {
        this.isBinding = false;
        this.snack.open('Student bound to terminal user id', 'Close', { duration: 2500 });
        this.newTerminalUserId = '';
        this.resetStudentPick();
        this.load();
      },
      error: (err) => {
        this.isBinding = false;
        const msg = err?.error?.message || 'Failed to save binding';
        this.snack.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  askRemove(b: BiometricTerminalBinding): void {
    this.toRemove = b;
  }

  cancelRemove(): void {
    this.toRemove = null;
  }

  confirmRemove(): void {
    if (!this.toRemove) return;
    this.isRemoving = true;
    this.api.unbindBiometricTerminalUser(this.serial, this.toRemove.terminalUserId).subscribe({
      next: () => {
        this.isRemoving = false;
        this.toRemove = null;
        this.snack.open('Binding removed', 'Close', { duration: 2500 });
        this.load();
      },
      error: () => {
        this.isRemoving = false;
        this.snack.open('Failed to remove binding', 'Close', { duration: 3000 });
      },
    });
  }

  classLabel(b: BiometricTerminalBinding): string {
    if (!b.className) return '—';
    return b.sectionName ? `${b.className} - ${b.sectionName}` : b.className;
  }

  // ── Inline edit of terminal user id ─────────────────────────────

  startEdit(b: BiometricTerminalBinding): void {
    this.editingTuid = b.terminalUserId;
    this.editedTuidValue = b.terminalUserId;
  }

  cancelEdit(): void {
    this.editingTuid = null;
    this.editedTuidValue = '';
  }

  saveEdit(b: BiometricTerminalBinding): void {
    const next = this.editedTuidValue.trim();
    if (!next || next === b.terminalUserId) {
      this.cancelEdit();
      return;
    }
    this.isSavingEdit = true;
    this.api.updateBiometricTerminalBinding(this.serial, b.terminalUserId, next).subscribe({
      next: () => {
        this.isSavingEdit = false;
        this.cancelEdit();
        this.snack.open('Terminal user id updated', 'Close', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.isSavingEdit = false;
        const msg = err?.error?.message || 'Failed to update binding';
        this.snack.open(msg, 'Close', { duration: 3500 });
      },
    });
  }
}
