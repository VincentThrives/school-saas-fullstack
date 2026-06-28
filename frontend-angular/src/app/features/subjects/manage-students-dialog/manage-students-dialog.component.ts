import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SubjectService } from '../../../core/services/subject.service';

interface ClassSectionOption {
  /** `classId::sectionId` — the same composite key the candidate
   *  filter compares against. */
  key: string;
  /** Human-readable "11th - A". Computed by the parent from its
   *  classLookup so the dialog doesn't need its own class fetch. */
  label: string;
}

interface DialogData {
  subjectId: string;
  subjectName: string;
  /** Class+section options the parent already had in memory — feeds
   *  the dropdown directly. Empty means "no scoping needed". */
  classSectionOptions: ClassSectionOption[];
}

interface Candidate {
  studentId: string;
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  classId?: string;
  sectionId?: string;
}

/**
 * Standalone dialog for managing the enrolled-student list of an
 * elective subject (PU 2nd-language Kannada, etc). Opened from the
 * "Manage Students" action on each elective row in the Subjects list.
 *
 * <p>Independent of the Subject form / Edit dialog so saving an
 * unrelated edit on the subject can't accidentally wipe the picked
 * roster. The dialog talks to its own endpoint pair —
 * {@code GET /subjects/{id}/eligible-students} for the candidate pool
 * + current ticks, {@code PUT /subjects/{id}/enrolled-students} to
 * persist the change.</p>
 */
@Component({
  selector: 'app-manage-students-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './manage-students-dialog.component.html',
  styleUrl: './manage-students-dialog.component.scss',
})
export class ManageStudentsDialogComponent implements OnInit {
  candidates: Candidate[] = [];
  enrolled = new Set<string>();
  isLoading = false;
  isSaving = false;
  searchQuery = '';

  /** Selected option key in the class+section dropdown. Empty = "All".
   *  Filters the visible list to one (class, section) pair so admins
   *  can tick a class at a time when the candidate pool is large. */
  selectedClassSectionKey = '';

  constructor(
    private subjectService: SubjectService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ManageStudentsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.subjectService.getEligibleStudents(this.data.subjectId).subscribe({
      next: (res) => {
        const body = res?.data || {};
        this.candidates = (body.students || []).map((s: any) => ({
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          rollNumber: s.rollNumber,
          classId: s.classId,
          sectionId: s.sectionId,
        }));
        // Group by (class, section) first using the dropdown's
        // option order — so the list lays out like a real roster:
        // 11th-A together, then 11th-B, then 11th-C. Within each
        // group, alphabetic by full name so admins scan the way
        // they'd read a printed sheet. Pairs not in the options
        // (defensive — shouldn't happen) sink to the bottom.
        const optionKeys = (this.data.classSectionOptions || []).map(o => o.key);
        const orderOf = (c: Candidate): number => {
          const key = `${c.classId || ''}::${c.sectionId || ''}`;
          const i = optionKeys.indexOf(key);
          return i < 0 ? Number.MAX_SAFE_INTEGER : i;
        };
        this.candidates.sort((a, b) => {
          const da = orderOf(a), db = orderOf(b);
          if (da !== db) return da - db;
          return this.fullName(a).toLowerCase().localeCompare(this.fullName(b).toLowerCase());
        });
        this.enrolled = new Set<string>(body.enrolledStudentIds || []);
        // Default behavior for an elective that hasn't been managed
        // yet: tick everyone. Admin then unticks the ones who don't
        // take this subject. Matches the "every student takes it"
        // semantic of a non-elective until the admin saves a subset.
        if (this.enrolled.size === 0 && this.candidates.length > 0) {
          this.candidates.forEach(c => this.enrolled.add(c.studentId));
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to load students', 'Close', { duration: 4000 });
      },
    });
  }

  isEnrolled(studentId: string): boolean { return this.enrolled.has(studentId); }

  toggle(studentId: string, checked: boolean): void {
    if (checked) this.enrolled.add(studentId);
    else this.enrolled.delete(studentId);
  }

  selectAll(): void {
    this.filteredCandidates.forEach(c => this.enrolled.add(c.studentId));
  }

  clearAll(): void {
    this.filteredCandidates.forEach(c => this.enrolled.delete(c.studentId));
  }

  get filteredCandidates(): Candidate[] {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const chipKey = this.selectedClassSectionKey;
    return this.candidates.filter(c => {
      if (chipKey && `${c.classId || ''}::${c.sectionId || ''}` !== chipKey) return false;
      if (!q) return true;
      const full = `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
      return full.includes(q) || (c.rollNumber || '').toLowerCase().includes(q);
    });
  }


  fullName(c: Candidate): string {
    const n = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    return n || c.studentId;
  }

  /** Class+section label for a student row — looked up from the
   *  dropdown options the parent already built. Empty string when
   *  the student's pair isn't in the options (defensive — shouldn't
   *  happen in normal use). */
  classSectionLabelFor(c: Candidate): string {
    const key = `${c.classId || ''}::${c.sectionId || ''}`;
    const opt = (this.data.classSectionOptions || []).find(o => o.key === key);
    return opt?.label || '';
  }

  get enrolledCount(): number { return this.enrolled.size; }
  get totalCount(): number { return this.candidates.length; }

  save(): void {
    this.isSaving = true;
    const payload = this.candidates
      .filter(c => this.enrolled.has(c.studentId))
      .map(c => c.studentId);
    this.subjectService.updateEnrolledStudents(this.data.subjectId, payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Enrolled students saved', 'Close', { duration: 2500 });
        this.dialogRef.close({ saved: true, count: payload.length });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Save failed', 'Close', { duration: 4000 });
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
