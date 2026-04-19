import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SubjectService } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear, Syllabus, UserRole, Teacher, TeacherSubjectAssignment } from '../../../core/models';

@Component({
  selector: 'app-syllabus-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './syllabus-list.component.html',
  styleUrl: './syllabus-list.component.scss',
})
export class SyllabusListComponent implements OnInit {
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  syllabusList: Syllabus[] = [];
  isLoading = false;

  // Cascading filters
  selectedAcademicYearId = '';
  selectedClassId = '';
  selectedSectionId = '';
  selectedSubjectId = '';

  isAdmin = false;
  isTeacher = false;
  myTeacher: Teacher | null = null;
  myAssignments: TeacherSubjectAssignment[] = [];

  // Precomputed option arrays (recomputed from handlers, not from getters).
  classOptions: SchoolClass[] = [];
  sectionOptions: { sectionId: string; name: string }[] = [];
  subjectOptions: { id: string; name: string }[] = [];

  // Delete dialog
  deleteDialogOpen = false;
  selectedForDelete: Syllabus | null = null;
  isDeleting = false;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private subjectService: SubjectService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL);
    this.isTeacher = this.authService.hasRole(UserRole.TEACHER);

    this.subjectService.loadSubjects();

    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = res.data || [];
        this.recomputeClassOptions();
      },
      error: () => { this.classes = []; this.classOptions = []; },
    });

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = res.data || [];
        const current = this.academicYears.find((ay) => ay.current);
        if (current) this.selectedAcademicYearId = current.academicYearId;

        if (this.isTeacher) {
          // Teacher: fetch own profile AND assignments for subject/class narrowing.
          this.api.getMyTeacherProfile().subscribe({
            next: (t) => { this.myTeacher = t?.data || null; },
          });
          this.api.getMyTeacherAssignments(this.selectedAcademicYearId).subscribe({
            next: (res) => {
              this.myAssignments = res?.data || [];
              this.recomputeClassOptions();
              this.loadSyllabus();
            },
            error: () => {
              this.myAssignments = [];
              this.recomputeClassOptions();
              this.loadSyllabus();
            },
          });
        } else {
          this.loadSyllabus();
        }
      },
      error: () => this.loadSyllabus(),
    });
  }

  // ── Cascading options (precomputed, NOT getters) ────────────────────

  /** Show classes matching the selected AY; fall back to all classes if that yields zero.
   *  For teachers, narrow to classes in their classSubjectAssignments. */
  private recomputeClassOptions(): void {
    let list = this.classes;
    if (this.selectedAcademicYearId) {
      const narrowed = list.filter(c => (c as any).academicYearId === this.selectedAcademicYearId);
      if (narrowed.length > 0) list = narrowed;
    }
    if (this.isTeacher && this.myTeacher?.classSubjectAssignments) {
      const allowed = new Set(this.myTeacher.classSubjectAssignments.map((a: any) => a.classId));
      list = list.filter(c => allowed.has(c.classId));
    }
    this.classOptions = list;
  }

  private recomputeSectionOptions(): void {
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    if (!cls || !cls.sections) { this.sectionOptions = []; return; }
    let list: any[] = cls.sections.map(s => ({
      sectionId: (s as any).sectionId,
      name: (s as any).name,
    }));
    if (this.isTeacher && this.myTeacher?.classSubjectAssignments) {
      const secIds = new Set(
        this.myTeacher.classSubjectAssignments
          .filter((a: any) => a.classId === this.selectedClassId)
          .map((a: any) => a.sectionId)
          .filter(Boolean));
      if (secIds.size > 0) list = list.filter(s => secIds.has(s.sectionId));
    }
    this.sectionOptions = list;
  }

  /** Subjects load only when both Class and Section are selected, from that Section's subjectIds.
   *  For teachers, narrow further to subjects they're assigned to for that class/section. */
  private recomputeSubjectOptions(): void {
    if (!this.selectedClassId || !this.selectedSectionId) { this.subjectOptions = []; return; }
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    if (!cls) { this.subjectOptions = []; return; }
    const section = (cls.sections || []).find(sec => (sec as any).sectionId === this.selectedSectionId);
    if (!section) { this.subjectOptions = []; return; }
    const ids = new Set<string>((section as any).subjectIds || []);
    let all = Array.from(ids).map(id => ({
      id,
      name: this.subjectService.getSubjectName(id),
    }));
    if (this.isTeacher && this.myTeacher?.classSubjectAssignments) {
      const allowed = new Set(
        this.myTeacher.classSubjectAssignments
          .filter((a: any) => a.classId === this.selectedClassId
            && (!a.sectionId || a.sectionId === this.selectedSectionId))
          .map((a: any) => a.subjectId));
      all = all.filter(s => allowed.has(s.id));
    }
    this.subjectOptions = all;
  }

  // ── Handlers ─────────────────────────────────────────────────────────

  onYearChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedSubjectId = '';
    this.recomputeClassOptions();
    this.sectionOptions = [];
    this.subjectOptions = [];
    this.loadSyllabus();
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedSubjectId = '';
    this.recomputeSectionOptions();
    this.recomputeSubjectOptions();
    this.loadSyllabus();
  }

  onSectionChange(): void {
    this.selectedSubjectId = '';
    this.recomputeSubjectOptions();
    this.loadSyllabus();
  }

  onSubjectChange(): void {
    this.loadSyllabus();
  }

  loadSyllabus(): void {
    this.isLoading = true;
    const params: any = {};
    if (this.selectedAcademicYearId) params.academicYearId = this.selectedAcademicYearId;
    if (this.selectedClassId) params.classId = this.selectedClassId;
    if (this.selectedSectionId) params.sectionId = this.selectedSectionId;
    if (this.selectedSubjectId) params.subjectId = this.selectedSubjectId;
    if (this.isTeacher) params.mine = true;

    this.api.getSyllabusList(params).subscribe({
      next: (res) => {
        this.syllabusList = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.syllabusList = [];
        this.isLoading = false;
      },
    });
  }

  // ── Stats ────────────────────────────────────────────────────────────

  get totalCount(): number { return this.syllabusList.length; }
  get inProgressCount(): number {
    return this.syllabusList.filter(s => s.progressPercentage > 0 && s.progressPercentage < 100).length;
  }
  get completedCount(): number {
    return this.syllabusList.filter(s => s.progressPercentage >= 100).length;
  }
  get averageProgress(): number {
    if (this.syllabusList.length === 0) return 0;
    const sum = this.syllabusList.reduce((a, s) => a + (s.progressPercentage || 0), 0);
    return Math.round(sum / this.syllabusList.length);
  }

  // ── UI helpers ───────────────────────────────────────────────────────

  progressColor(p: number): 'primary' | 'accent' | 'warn' {
    if (p >= 70) return 'primary';
    if (p >= 30) return 'accent';
    return 'warn';
  }

  canModify(s: Syllabus): boolean {
    if (this.isAdmin) return true;
    if (!this.isTeacher || !this.myTeacher) return false;
    // Direct ownership
    if (s.teacherId && this.myTeacher.teacherId === s.teacherId) return true;
    // New canonical source — TeacherSubjectAssignment collection
    const hit = (this.myAssignments || []).some(a =>
      a.classId === s.classId
      && (a.status !== 'ARCHIVED')
      && a.subjectId === s.subjectId
      && (!a.sectionId || !s.sectionId || a.sectionId === s.sectionId));
    if (hit) return true;
    // Legacy fallback — old inline field (pre-migration teachers)
    const assigns = this.myTeacher.classSubjectAssignments || [];
    return assigns.some((a: any) =>
      a.classId === s.classId
      && (!a.sectionId || !s.sectionId || a.sectionId === s.sectionId)
      && a.subjectId === s.subjectId,
    );
  }

  // ── Navigation ───────────────────────────────────────────────────────

  viewDetail(syllabusId: string): void {
    this.router.navigate(['/syllabus', syllabusId]);
  }

  editSyllabus(event: Event, s: Syllabus): void {
    event.stopPropagation();
    this.router.navigate(['/syllabus', s.syllabusId, 'edit']);
  }

  createSyllabus(): void {
    this.router.navigate(['/syllabus/new']);
  }

  // ── Delete ────────────────────────────────────────────────────────────

  confirmDelete(event: Event, s: Syllabus): void {
    event.stopPropagation();
    this.selectedForDelete = s;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedForDelete = null;
  }

  deleteSyllabus(): void {
    if (!this.selectedForDelete) return;
    this.isDeleting = true;
    const id = this.selectedForDelete.syllabusId;
    this.api.deleteSyllabus(id).subscribe({
      next: () => {
        this.snackBar.open('Syllabus deleted', 'Close', { duration: 2500 });
        this.isDeleting = false;
        this.deleteDialogOpen = false;
        this.selectedForDelete = null;
        this.loadSyllabus();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete syllabus', 'Close', { duration: 3000 });
        this.isDeleting = false;
      },
    });
  }
}
