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
  formClassId = '';
  formSectionId = '';
  formSubjectId = '';
  formRoleClass = false;
  formRoleSubject = true;

  formClassOptions: SchoolClass[] = [];
  formSectionOptions: SectionLite[] = [];
  formSubjectOptions: { id: string; name: string }[] = [];

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
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.subjectService.loadSubjects();
    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
      this.recomputeFormClassOptions();
      this.recomputeFilterClassOptions();
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) this.selectedAcademicYearId = current.academicYearId;
      this.recomputeFilterClassOptions();
      this.loadAssignments();
    });
    this.loadTeachers();

    // Search filter predicate on the table data source.
    this.dataSource.filterPredicate = (a: TeacherSubjectAssignment, filter: string) => {
      if (!filter) return true;
      const t = this.teacherName(a.teacherId).toLowerCase();
      const c = this.classLabel(a).toLowerCase();
      const s = this.sectionLabel(a).toLowerCase();
      const subj = this.subjectLabel(a).toLowerCase();
      return (t + ' ' + c + ' ' + s + ' ' + subj).includes(filter);
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
    this.loadAssignments();
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

  private recomputeFilterClassOptions(): void {
    let list = this.classes;
    if (this.selectedAcademicYearId) {
      const narrowed = list.filter((c: any) => c.academicYearId === this.selectedAcademicYearId);
      if (narrowed.length > 0) list = narrowed;
    }
    this.filterClassOptions = list;
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
    this.editingId = null;
    this.formTeacherId = '';
    this.formClassId = '';
    this.formSectionId = '';
    this.formSubjectId = '';
    this.formRoleClass = false;
    this.formRoleSubject = true;
    this.recomputeFormClassOptions();
    this.formSectionOptions = [];
    this.formSubjectOptions = [];
    this.formOpen = true;
  }

  openEditForm(a: TeacherSubjectAssignment): void {
    this.editingId = a.assignmentId;
    this.formTeacherId = a.teacherId;
    this.formClassId = a.classId;
    this.formSectionId = a.sectionId || '';
    this.formSubjectId = a.subjectId || '';
    this.formRoleClass = (a.roles || []).includes('CLASS_TEACHER');
    this.formRoleSubject = (a.roles || []).includes('SUBJECT_TEACHER');
    this.recomputeFormClassOptions();
    this.recomputeFormSectionOptions();
    this.recomputeFormSubjectOptions();
    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
  }

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

  private recomputeFormClassOptions(): void {
    let list = this.classes;
    if (this.selectedAcademicYearId) {
      const narrowed = list.filter((c: any) => c.academicYearId === this.selectedAcademicYearId);
      if (narrowed.length > 0) list = narrowed;
    }
    this.formClassOptions = list;
  }

  private recomputeFormSectionOptions(): void {
    const cls = this.classes.find(c => c.classId === this.formClassId);
    if (!cls || !cls.sections) { this.formSectionOptions = []; return; }
    this.formSectionOptions = cls.sections.map((s: any) => ({
      sectionId: s.sectionId,
      name: s.name,
      subjectIds: s.subjectIds,
    }));
  }

  private recomputeFormSubjectOptions(): void {
    if (!this.formClassId) { this.formSubjectOptions = []; return; }
    const cls = this.classes.find(c => c.classId === this.formClassId);
    if (!cls) { this.formSubjectOptions = []; return; }
    const ids = new Set<string>();
    (cls.sections || []).forEach((sec: any) => {
      if (this.formSectionId && sec.sectionId !== this.formSectionId) return;
      (sec.subjectIds || []).forEach((id: string) => ids.add(id));
    });
    this.formSubjectOptions = Array.from(ids).map(id => ({
      id,
      name: this.subjectService.getSubjectName(id),
    }));
  }

  saveForm(): void {
    if (!this.formTeacherId || !this.formClassId || !this.selectedAcademicYearId) {
      this.snackBar.open('Select teacher, class and year.', 'Close', { duration: 2500 });
      return;
    }
    const roles: TeacherAssignmentRole[] = [];
    if (this.formRoleClass) roles.push('CLASS_TEACHER');
    if (this.formRoleSubject) roles.push('SUBJECT_TEACHER');
    if (roles.length === 0) {
      this.snackBar.open('Pick at least one role.', 'Close', { duration: 2500 });
      return;
    }
    if (this.formRoleSubject && !this.formSubjectId) {
      this.snackBar.open('Subject Teacher role needs a subject.', 'Close', { duration: 2500 });
      return;
    }

    const req: CreateTeacherAssignmentRequest = {
      teacherId: this.formTeacherId,
      academicYearId: this.selectedAcademicYearId,
      classId: this.formClassId,
      sectionId: this.formSectionId || undefined,
      subjectId: this.formSubjectId || undefined,
      roles,
    };
    this.isSaving = true;
    const obs = this.editingId
      ? this.api.updateTeacherAssignment(this.editingId, req)
      : this.api.createTeacherAssignment(req);
    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open(this.editingId ? 'Assignment updated' : 'Assignment created', 'Close', { duration: 2000 });
        this.closeForm();
        this.loadAssignments();
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save assignment', 'Close', { duration: 3000 });
      },
    });
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
    this.isCarrying = true;
    this.api.carryForwardTeacherAssignments({
      fromAcademicYearId: this.carryFromYearId,
      toAcademicYearId: this.carryToYearId,
      skipExisting: true,
    }).subscribe({
      next: (res) => {
        this.isCarrying = false;
        this.closeCarry();
        const n = res.data?.copied ?? 0;
        this.snackBar.open(`Copied ${n} assignment(s)`, 'Close', { duration: 3000 });
        this.loadAssignments();
      },
      error: (err) => {
        this.isCarrying = false;
        this.snackBar.open(err?.error?.message || 'Carry-forward failed', 'Close', { duration: 3000 });
      },
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
    if (!cls || !cls.sections) return a.sectionId;
    const sec = (cls.sections as any[]).find(s => s.sectionId === a.sectionId);
    return sec ? sec.name : a.sectionId;
  }

  subjectLabel(a: TeacherSubjectAssignment): string {
    if (!a.subjectId) return '—';
    return this.subjectService.getSubjectName(a.subjectId);
  }

  rolesLabel(roles: TeacherAssignmentRole[] = []): string[] {
    return (roles || []).map(r => r === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher');
  }
}
