import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear, UserRole } from '../../../core/models';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-exams-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './exams-list.component.html',
  styleUrl: './exams-list.component.scss',
})
export class ExamsListComponent implements OnInit {
  exams: any[] = [];
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  classMap: Record<string, string> = {};
  sectionMap: Record<string, string> = {};
  displayedColumns = ['examType', 'name', 'class', 'subject', 'date', 'maxMarks', 'status', 'enterMarks', 'viewResults', 'actions'];
  marksCountMap: Record<string, number> = {};

  academicYearFilter = '';
  classFilter = '';
  sectionFilter = '';
  subjectFilter = '';
  sections: { sectionId: string; name: string }[] = [];
  subjectsList: { subjectId: string; name: string }[] = [];

  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  isLoading = false;

  deleteDialogOpen = false;
  selectedExam: any = null;

  // Teacher-mode scoping: when a teacher is logged in, only exams that match
  // one of their (classId, sectionId, subjectId) assignment tuples are shown.
  // If no precise tuples are available, fall back to a subjectId-only match.
  isTeacherMode = false;
  private teacherTuples = new Set<string>();
  private teacherSubjectIds = new Set<string>();
  private teacherProfileLoaded = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  /**
   * Push the active filters into the URL as query params so back-
   * navigating from Enter Marks / Results lands on the same filtered
   * view. Earlier the filters were component-only state, so destroying
   * the component on navigation wiped them — admins came back from
   * saving marks for "Class 3 / Section A" and saw the unfiltered list.
   *
   * <p>{@code replaceUrl: true} keeps history clean — typing into the
   * dropdowns doesn't litter the browser back-stack with intermediate
   * entries. Only meaningful navigations (Enter Marks, Results) create
   * back-stack entries.</p>
   */
  private syncFiltersToUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ay: this.academicYearFilter || null,
        classId: this.classFilter || null,
        sectionId: this.sectionFilter || null,
        subjectId: this.subjectFilter || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngOnInit(): void {
    this.isTeacherMode = this.auth.currentRole === UserRole.TEACHER;

    // Restore prior filter selection from URL query params if the
    // admin is returning from Enter Marks / Results. Snapshot is fine
    // here — we only care about the values present at the moment we
    // land on the page, not subsequent changes.
    const qp = this.route.snapshot.queryParamMap;
    const urlAy = qp.get('ay') || '';
    const urlClass = qp.get('classId') || '';
    const urlSection = qp.get('sectionId') || '';
    const urlSubject = qp.get('subjectId') || '';

    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
        // Prefer the AY in the URL — that's what the admin had picked
        // before they walked into Enter Marks. Fall back to the
        // current AY only when no URL filter exists.
        const fromUrl = urlAy && this.academicYears.find(y => y.academicYearId === urlAy);
        const current = this.academicYears.find(y => y.current);
        const initialAy = fromUrl || current;
        if (initialAy) {
          this.academicYearFilter = initialAy.academicYearId;
          this.loadClassesForYear(initialAy.academicYearId, () => {
            // Once classes have loaded, replay the rest of the cascade
            // from URL — picking class enables Section + Subject
            // selectors and primes the dependent lists.
            if (urlClass) {
              this.classFilter = urlClass;
              const cls = this.classes.find(c => c.classId === urlClass);
              this.sections = cls?.sections || [];
              if (urlSection) {
                this.sectionFilter = urlSection;
                const sec = cls?.sections?.find(s => s.sectionId === urlSection);
                const subjectIds = sec?.subjectIds || [];
                if (subjectIds.length > 0) {
                  this.subjectService.getSubjectsByIds(subjectIds).subscribe({
                    next: (subs) => {
                      this.subjectsList = subs.map(s => ({ subjectId: s.subjectId, name: s.name }));
                      if (urlSubject) this.subjectFilter = urlSubject;
                    },
                  });
                }
              }
            }
          });
        }
      },
    });

    if (this.isTeacherMode) {
      // Source of truth for what a teacher teaches lives in the
      // teacher_subject_assignments collection, NOT on the Teacher document.
      // Fetch the logged-in teacher's assignments (across all academic years
      // — the academic-year dropdown above narrows the displayed exams).
      this.api.getMyTeacherAssignments().subscribe({
        next: (res) => {
          const list = (res?.data as any[]) || [];
          for (const a of list) {
            if (!a?.subjectId) continue;
            this.teacherTuples.add(`${a.classId || ''}::${a.sectionId || ''}::${a.subjectId}`);
            this.teacherSubjectIds.add(a.subjectId);
          }
          this.teacherProfileLoaded = true;
        },
        error: () => { this.teacherProfileLoaded = true; },
      });
    }

    this.loadExams();
  }

  onAcademicYearFilterChange(): void {
    this.classFilter = '';
    this.sectionFilter = '';
    this.subjectFilter = '';
    this.classes = [];
    this.sections = [];
    this.subjectsList = [];
    this.classMap = {};
    if (this.academicYearFilter) {
      this.loadClassesForYear(this.academicYearFilter);
    }
    this.resetPagination();
    this.syncFiltersToUrl();
  }

  onClassFilterChange(): void {
    this.sectionFilter = '';
    this.subjectFilter = '';
    this.subjectsList = [];
    const cls = this.classes.find(c => c.classId === this.classFilter);
    this.sections = cls?.sections || [];
    this.resetPagination();
    this.syncFiltersToUrl();
  }

  onSectionFilterChange(): void {
    this.subjectFilter = '';
    this.subjectsList = [];
    if (!this.classFilter) { this.syncFiltersToUrl(); return; }
    const cls = this.classes.find(c => c.classId === this.classFilter);
    const sec = cls?.sections?.find(s => s.sectionId === this.sectionFilter);
    const subjectIds = sec?.subjectIds || [];
    if (subjectIds.length > 0) {
      this.subjectService.getSubjectsByIds(subjectIds).subscribe({
        next: (subs) => { this.subjectsList = subs.map(s => ({ subjectId: s.subjectId, name: s.name })); },
      });
    }
    this.resetPagination();
    this.syncFiltersToUrl();
  }

  onSubjectFilterChange(): void {
    this.resetPagination();
    this.syncFiltersToUrl();
  }

  /**
   * @param done optional callback invoked once classes have loaded —
   * lets ngOnInit replay the rest of the URL-cascade (section + subject)
   * after the classes are in memory.
   */
  private loadClassesForYear(yearId: string, done?: () => void): void {
    this.api.getClasses(yearId).subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        this.classes.forEach(cls => {
          this.classMap[cls.classId] = cls.name;
          (cls.sections || []).forEach(sec => {
            this.sectionMap[sec.sectionId] = sec.name;
          });
        });
        if (done) done();
      },
      error: () => { if (done) done(); },
    });
  }

  getClassName(classId: string): string {
    return this.classMap[classId] || '-';
  }

  getSectionName(sectionId: string): string {
    if (!sectionId) return '';
    return this.sectionMap[sectionId] || '';
  }

  getSubjectName(subjectId: string): string {
    return this.subjectService.getSubjectName(subjectId);
  }

  loadExams(): void {
    this.isLoading = true;
    this.api.getExams().subscribe({
      next: (res) => {
        const exams = res.data || [];
        // Resolve class names early so they're in the map before render.
        exams.forEach(exam => {
          if (exam.classId && !this.classMap[exam.classId]) {
            this.classMap[exam.classId] = exam.className || exam.classId;
          }
        });
        if (exams.length === 0) {
          this.exams = [];
          this.totalElements = 0;
          this.isLoading = false;
          return;
        }
        // ── Wait for EVERY marks-count fetch before flipping isLoading
        // off and rendering the table. Earlier behaviour set
        // isLoading = false right after getExams resolved and let the
        // counts trickle in as separate subscriptions, which produced
        // the "Enter Marks" button on a subject the teacher had just
        // finished marking — the count for that exam hadn't arrived
        // yet. forkJoin closes the race: rows render once with the
        // correct Edit/Enter labels in place.
        //
        // A per-exam catchError keeps a single failed count from
        // breaking the whole list — that one exam just stays at 0.
        const countCalls = exams.map(exam => {
          const examId = exam.examId || exam.id;
          return this.api.getExamMarks(examId).pipe(
            catchError(() => of({ data: [] as any[] } as any)),
          );
        });
        forkJoin(countCalls).subscribe({
          next: (results) => {
            const next: Record<string, number> = { ...this.marksCountMap };
            exams.forEach((exam, i) => {
              const examId = exam.examId || exam.id;
              const entries = (results[i] as any)?.data || [];
              next[examId] = entries.length;
            });
            // Replace the reference so default change detection picks
            // it up cleanly even when the next render uses OnPush
            // anywhere downstream.
            this.marksCountMap = next;
            this.exams = exams;
            this.totalElements = exams.length;
            this.isLoading = false;
          },
          error: () => {
            // forkJoin shouldn't fail because each call has its own
            // catchError, but keep this as a safety net so the page
            // doesn't get stuck in the loading state.
            this.exams = exams;
            this.totalElements = exams.length;
            this.isLoading = false;
          },
        });
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  /**
   * Slice of {@link filteredExams} for the current page. The table
   * binds to this, NOT to the full filtered list — otherwise the
   * paginator at the bottom changed the page counter but the rows
   * never updated, which is what made it look "broken" (29 exams,
   * page-1-of-2 visible but Next did nothing).
   */
  get pagedExams(): any[] {
    const all = this.filteredExams;
    const start = this.pageIndex * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  get filteredExams(): any[] {
    let result = this.exams;

    // Teacher mode: only show exams that match one of the teacher's assignments.
    // While the profile is still loading we hide everything to avoid leaking
    // other teachers' subjects through a flash of unfiltered rows.
    if (this.isTeacherMode) {
      if (!this.teacherProfileLoaded) return [];
      result = result.filter(e => this.matchesTeacherScope(e));
    }

    if (this.academicYearFilter) {
      result = result.filter(e => e.academicYearId === this.academicYearFilter);
    }
    if (this.classFilter) {
      result = result.filter(e => e.classId === this.classFilter);
    }
    if (this.sectionFilter) {
      result = result.filter(e => e.sectionId === this.sectionFilter);
    }
    if (this.subjectFilter) {
      result = result.filter(e => e.subjectId === this.subjectFilter);
    }
    return result;
  }

  private matchesTeacherScope(exam: any): boolean {
    if (!exam?.subjectId) return false;
    if (this.teacherTuples.size > 0) {
      const key = `${exam.classId || ''}::${exam.sectionId || ''}::${exam.subjectId}`;
      if (this.teacherTuples.has(key)) return true;
    }
    // Fallback: subject-only match (covers older accounts where the precise
    // class/section assignment list isn't populated on the Teacher document).
    return this.teacherSubjectIds.has(exam.subjectId);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  /**
   * Reset the paginator to page 1 whenever the filter set changes —
   * otherwise switching from a 29-exam class to a 4-exam class while
   * sitting on page 2 leaves the table empty (page 2 of 4 = nothing).
   */
  private resetPagination(): void {
    this.pageIndex = 0;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'primary';
      case 'ONGOING': return 'accent';
      case 'COMPLETED': return 'primary';
      default: return '';
    }
  }

  createExam(): void {
    this.router.navigate(['/exams/new']);
  }

  editExam(exam: any): void {
    this.router.navigate(['/exams', exam.examId || exam.id, 'edit']);
  }

  getMarksCount(exam: any): number {
    return this.marksCountMap[exam.examId || exam.id] || 0;
  }

  hasMarksEntered(exam: any): boolean {
    return this.getMarksCount(exam) > 0;
  }

  enterMarks(exam: any): void {
    this.router.navigate(['/exams', exam.examId || exam.id, 'marks']);
  }

  lockMarks(exam: any): void {
    const examId = exam.examId || exam.id;
    this.api.lockMarks(examId).subscribe({
      next: () => {
        this.snackBar.open('Marks locked successfully', 'Close', { duration: 3000 });
        this.loadExams();
      },
      error: () => {
        this.snackBar.open('Failed to lock marks', 'Close', { duration: 3000 });
      },
    });
  }

  unlockMarks(exam: any): void {
    const examId = exam.examId || exam.id;
    this.api.unlockMarks(examId).subscribe({
      next: () => {
        this.snackBar.open('Marks unlocked successfully', 'Close', { duration: 3000 });
        this.loadExams();
      },
      error: () => {
        this.snackBar.open('Failed to unlock marks', 'Close', { duration: 3000 });
      },
    });
  }

  viewResults(exam: any): void {
    this.router.navigate(['/exams', exam.examId || exam.id, 'results']);
  }

  deleteExam(exam: any): void {
    this.selectedExam = exam;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedExam = null;
  }

  confirmDelete(): void {
    if (!this.selectedExam) return;
    const examId = this.selectedExam.examId || this.selectedExam.id;
    const name = this.selectedExam.name;
    this.deleteDialogOpen = false;
    this.selectedExam = null;

    this.api.deleteExam(examId).subscribe({
      next: () => {
        this.snackBar.open(`Exam "${name}" deleted successfully`, 'Close', { duration: 3000 });
        this.loadExams();
      },
      error: () => {
        this.snackBar.open('Failed to delete exam', 'Close', { duration: 3000 });
      },
    });
  }

  getExamTypeLabel(examType: string): string {
    return examType || '-';
  }
}
