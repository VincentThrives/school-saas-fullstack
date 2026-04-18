import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SchoolClass, Student, Teacher, AcademicYear } from '../../../core/models';

interface MyClass {
  academicYearId: string;
  academicYearLabel: string;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  role: 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
}

@Component({
  selector: 'app-my-students',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-students.component.html',
  styleUrl: './my-students.component.scss',
})
export class MyStudentsComponent implements OnInit {
  isLoading = false;
  isLoadingStudents = false;
  noProfile = false;

  teacher: Teacher | null = null;
  allClasses: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];

  /**
   * All (academicYear, class, section) tuples the teacher owns.
   * Class-teacher truth is derived from SchoolClass.sections[].classTeacherId
   * (set by the admin in the Classes page). Subject-teacher truth is derived
   * from Teacher.classSubjectAssignments.
   */
  private allMyClasses: MyClass[] = [];

  // Filter dropdowns
  selectedAcademicYearId = '';
  selectedClassId = '';
  selectedSectionId = '';

  // Students table
  dataSource = new MatTableDataSource<Student>([]);
  displayedColumns = ['rollNumber', 'name', 'admissionNumber', 'gender', 'dob', 'parent'];
  searchQuery = '';

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (data: Student, filter: string): boolean => {
      if (!filter) return true;
      const hay = `${data.firstName || ''} ${data.lastName || ''} ${data.admissionNumber || ''} ${data.rollNumber || ''}`.toLowerCase();
      return hay.includes(filter);
    };
    this.bootstrap();
  }

  private bootstrap(): void {
    this.isLoading = true;
    this.api.getMyTeacherProfile().subscribe({
      next: (tRes) => {
        if (!tRes?.success || !tRes.data) {
          this.noProfile = true;
          this.isLoading = false;
          return;
        }
        this.teacher = tRes.data;
        this.loadClassesAndYears();
      },
      error: (err) => {
        this.isLoading = false;
        if (err?.status === 404) {
          this.noProfile = true;
        } else {
          this.snackBar.open('Could not load your profile', 'Close', { duration: 3000 });
        }
      },
    });
  }

  private loadClassesAndYears(): void {
    this.api.getClasses().subscribe({
      next: (cRes) => {
        this.allClasses = cRes.data || [];
        this.api.getAcademicYears().subscribe({
          next: (yRes) => {
            this.academicYears = yRes.data || [];
            this.computeMyClasses();
            this.isLoading = false;
            this.autoSelectDefaults();
          },
          error: () => { this.isLoading = false; },
        });
      },
      error: () => { this.isLoading = false; },
    });
  }

  /**
   * Authoritative source for class-teacher: every class's sections[].classTeacherId.
   * We scan them all and keep the ones that point to this teacher. Subject
   * assignments on the Teacher doc are folded in as well.
   */
  private computeMyClasses(): void {
    const t = this.teacher;
    if (!t) return;

    const myTeacherId = (t as any).teacherId;
    const myUserId = (t as any).userId;
    const out: MyClass[] = [];
    const keySeen = new Set<string>();

    for (const cls of this.allClasses) {
      const yearId = (cls as any).academicYearId || '';
      const yearLabel = this.labelForYear(yearId);
      for (const sec of (cls.sections || [])) {
        const secId = (sec as any).sectionId;
        const classTeacherId = (sec as any).classTeacherId;
        if (!secId) continue;

        // Class teacher relationship (primary source of truth is the Class doc)
        const isClassTeacher = !!classTeacherId && (
          classTeacherId === myTeacherId || classTeacherId === myUserId
        );

        // Subject teacher relationship
        const isSubjectTeacher = ((t as any).classSubjectAssignments || []).some(
          (a: any) => a.classId === cls.classId && a.sectionId === secId,
        );

        if (!isClassTeacher && !isSubjectTeacher) continue;

        const key = `${yearId}__${cls.classId}__${secId}`;
        if (keySeen.has(key)) continue;
        keySeen.add(key);

        out.push({
          academicYearId: yearId,
          academicYearLabel: yearLabel,
          classId: cls.classId,
          sectionId: secId,
          className: cls.name,
          sectionName: (sec as any).name || '',
          role: isClassTeacher ? 'CLASS_TEACHER' : 'SUBJECT_TEACHER',
        });
      }
    }

    out.sort((a, b) => {
      const roleDiff = (a.role === 'CLASS_TEACHER' ? 0 : 1) - (b.role === 'CLASS_TEACHER' ? 0 : 1);
      if (roleDiff !== 0) return roleDiff;
      if (a.academicYearLabel !== b.academicYearLabel) return a.academicYearLabel.localeCompare(b.academicYearLabel);
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.sectionName.localeCompare(b.sectionName);
    });

    this.allMyClasses = out;
  }

  /** Default to the class-teacher's own class in the current year, if any. */
  private autoSelectDefaults(): void {
    if (this.allMyClasses.length === 0) return;
    const current = this.academicYears.find(y => (y as any).current);
    const preferred = current && this.allMyClasses.find(
      c => c.role === 'CLASS_TEACHER' && c.academicYearId === (current as any).academicYearId,
    );
    const first = preferred || this.allMyClasses[0];
    this.selectedAcademicYearId = first.academicYearId;
    this.selectedClassId = first.classId;
    this.selectedSectionId = first.sectionId;
    this.loadStudents();
  }

  private labelForYear(yearId: string | undefined): string {
    if (!yearId) return '';
    const y = this.academicYears.find(ay => ay.academicYearId === yearId);
    return y?.label || '';
  }

  // ── Cascading dropdown options ────────────────────────────────────

  get academicYearOptions(): { academicYearId: string; label: string }[] {
    const seen = new Map<string, string>();
    for (const c of this.allMyClasses) {
      if (!seen.has(c.academicYearId)) seen.set(c.academicYearId, c.academicYearLabel);
    }
    return Array.from(seen.entries()).map(([academicYearId, label]) => ({ academicYearId, label }));
  }

  get classOptions(): { classId: string; name: string }[] {
    const set = new Map<string, string>();
    for (const c of this.allMyClasses) {
      if (c.academicYearId !== this.selectedAcademicYearId) continue;
      if (!set.has(c.classId)) set.set(c.classId, c.className);
    }
    return Array.from(set.entries()).map(([classId, name]) => ({ classId, name }));
  }

  get sectionOptions(): { sectionId: string; name: string; role: string }[] {
    return this.allMyClasses
      .filter(c => c.academicYearId === this.selectedAcademicYearId && c.classId === this.selectedClassId)
      .map(c => ({ sectionId: c.sectionId, name: c.sectionName, role: c.role }));
  }

  // ── Handlers ─────────────────────────────────────────────────────

  onAcademicYearChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.dataSource.data = [];
    const classes = this.classOptions;
    if (classes.length === 1) {
      this.selectedClassId = classes[0].classId;
      this.onClassChange();
    }
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.dataSource.data = [];
    const sections = this.sectionOptions;
    if (sections.length === 1) {
      this.selectedSectionId = sections[0].sectionId;
      this.loadStudents();
    }
  }

  onSectionChange(): void {
    this.loadStudents();
  }

  loadStudents(): void {
    if (!this.selectedClassId || !this.selectedSectionId) return;
    this.isLoadingStudents = true;
    this.api.getStudents(0, 500, {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId,
    }).subscribe({
      next: (res) => {
        this.dataSource.data = res.data?.content || [];
        this.applySearch();
        this.isLoadingStudents = false;
      },
      error: () => {
        this.dataSource.data = [];
        this.isLoadingStudents = false;
        this.snackBar.open('Failed to load students', 'Close', { duration: 3000 });
      },
    });
  }

  applySearch(): void {
    this.dataSource.filter = (this.searchQuery || '').trim().toLowerCase();
  }

  // ── Template helpers ──────────────────────────────────────────────

  get selectedMyClass(): MyClass | undefined {
    return this.allMyClasses.find(c =>
      c.academicYearId === this.selectedAcademicYearId &&
      c.classId === this.selectedClassId &&
      c.sectionId === this.selectedSectionId);
  }

  studentName(s: Student): string {
    return `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.admissionNumber;
  }

  studentInitial(s: Student): string {
    return (s.firstName || s.admissionNumber || '?').charAt(0).toUpperCase();
  }

  formatDate(d: string | undefined): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  }

  parentLine(s: Student): string {
    if (s.parentName) return s.parentName + (s.parentPhone ? ` · ${s.parentPhone}` : '');
    return s.parentPhone || '—';
  }
}
