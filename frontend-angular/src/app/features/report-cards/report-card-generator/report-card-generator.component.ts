import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { SelectionModel } from '@angular/cdk/collections';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { downloadOrOpenBlob } from '../../../shared/utils/download';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SchoolClass, AcademicYear, ReportCard } from '../../../core/models';

@Component({
  selector: 'app-report-card-generator',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatSelectModule, MatFormFieldModule,
    MatTableModule, MatPaginatorModule, MatCheckboxModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule, MatSnackBarModule, PageHeaderComponent,
  ],
  templateUrl: './report-card-generator.component.html',
  styleUrl: './report-card-generator.component.scss',
})
export class ReportCardGeneratorComponent implements OnInit, AfterViewInit {
  // Data sources
  academicYears: AcademicYear[] = [];
  allExams: any[] = [];
  examTypes: string[] = [];
  classes: SchoolClass[] = [];
  sections: { sectionId: string; name: string }[] = [];
  students: any[] = [];

  // Selected filters
  selectedAcademicYearId = '';
  selectedExamType = '';
  selectedClassId = '';
  selectedSectionId = '';
  selectedStudentId = '';

  // Report card data
  reportCards: any[] = [];
  filteredReportCards: any[] = [];
  studentMap: Record<string, any> = {};
  displayedColumns = ['select', 'studentName', 'rollNumber', 'percentage', 'grade', 'rank', 'actions'];
  selection = new SelectionModel<any>(true, []);
  isLoading = false;
  isGenerating = false;
  isDownloadingAll = false;

  /**
   * Pagination for the rendered table + mobile cards. The table binds
   * to {@link dataSource} which owns the paginator; the cards iterate
   * {@link pagedRows} which is the same slice the table currently
   * shows. Select-all still operates on the FULL filtered set so a
   * teacher hitting "Download All PDFs" gets every student in the
   * class, not just the visible page.
   */
  dataSource = new MatTableDataSource<any>([]);
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50, 100];

  /**
   * Paginator reference — wired via a SETTER instead of a property
   * because the {@code <mat-paginator>} sits inside an *ngIf that's
   * false until data arrives. With a plain @ViewChild the reference
   * resolves once at ngAfterViewInit (paginator absent → undefined)
   * and never updates when the element later materialises, so the
   * table renders every row, ignoring the page controls.
   *
   * <p>The setter fires every time the paginator appears or
   * disappears. When it's there we hook it to the dataSource and
   * apply any deferred firstPage() the data setter requested.</p>
   */
  private _paginator?: MatPaginator;
  private pendingFirstPage = false;

  @ViewChild(MatPaginator)
  set paginator(p: MatPaginator | undefined) {
    this._paginator = p;
    if (p) {
      this.dataSource.paginator = p;
      if (this.pendingFirstPage) {
        p.firstPage();
        this.pageIndex = 0;
        this.pendingFirstPage = false;
      }
    }
  }
  get paginator(): MatPaginator | undefined { return this._paginator; }

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngAfterViewInit(): void {
    // Most of the wiring happens in the paginator setter so it works
    // even when <mat-paginator> appears later. Nothing to do here.
  }

  /**
   * Single chokepoint for setting the filtered list — keeps
   * {@link filteredReportCards} (full set, used by select-all and
   * Download All), {@link dataSource} (drives the paginated table),
   * and the page index in sync. Without this, a section change could
   * leave the paginator pointing at page 4 of a 1-page result.
   *
   * <p>If the paginator isn't in the DOM yet ({@code *ngIf} on the
   * empty state hides it), the firstPage() request is deferred via
   * {@link pendingFirstPage} so it fires the moment the paginator
   * materialises through the setter.</p>
   */
  private setFilteredCards(cards: any[]): void {
    this.filteredReportCards = cards;
    this.dataSource.data = cards;
    if (this._paginator) {
      this._paginator.firstPage();
      this.pageIndex = 0;
    } else {
      this.pendingFirstPage = true;
      this.pageIndex = 0;
    }
  }

  /** Current paginator page slice — what the mobile cards iterate so
   *  they stay in lockstep with the desktop table's visible rows. */
  get pagedRows(): any[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredReportCards.slice(start, start + this.pageSize);
  }

  /** Paginator (page) output — sync our local indices for {@link pagedRows}. */
  onPageChange(ev: PageEvent): void {
    this.pageIndex = ev.pageIndex;
    this.pageSize = ev.pageSize;
  }

  ngOnInit(): void {
    // Academic years first. Exam types are derived per class+section once the admin
    // drills down — we only show types that actually have exams conducted for the scope.
    this.api.getAcademicYears().subscribe((ayRes) => {
      this.academicYears = ayRes.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.onAcademicYearChange();
      }
    });
  }

  /**
   * Re-derive the list of exam types shown in the dropdown. Only exams that exist
   * for the currently selected class (and section, if chosen) count. If the admin
   * hasn't picked a class yet, or the scope has no conducted exams, the list is empty.
   */
  private recomputeExamTypes(): void {
    if (!this.selectedClassId) {
      this.examTypes = [];
      return;
    }
    let scoped = this.allExams.filter((e: any) => e.classId === this.selectedClassId);
    if (this.selectedSectionId) {
      scoped = scoped.filter((e: any) => e.sectionId === this.selectedSectionId);
    }
    const types = new Set<string>();
    scoped.forEach((e: any) => { if (e.examType) types.add(e.examType); });
    this.examTypes = Array.from(types).sort();
  }

  onAcademicYearChange(): void {
    this.selectedExamType = '';
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.classes = [];
    this.sections = [];
    this.students = [];
    this.reportCards = [];
    this.setFilteredCards([]);
    this.allExams = [];
    this.examTypes = [];
    this.selection.clear();

    if (!this.selectedAcademicYearId) {
      return;
    }

    // Load classes and exams scoped to this academic year. Exam types are derived
    // from the loaded exams once class + section are selected.
    this.api.getClasses(this.selectedAcademicYearId).subscribe((res) => {
      this.classes = res.data || [];
    });
    this.api.getExams().subscribe((res) => {
      this.allExams = (res?.data || []).filter((e: any) => e.academicYearId === this.selectedAcademicYearId);
      this.recomputeExamTypes();
    });
  }

  onExamTypeChange(): void {
    // Section is part of the cascade ABOVE exam type now (year → class →
    // section → exam type), so we must NOT clear it here. The earlier
    // reset made the section dropdown look empty after picking an exam
    // type and silently broadened the loaded set to the whole class.
    this.selectedStudentId = '';
    this.reportCards = [];
    this.setFilteredCards([]);
    this.selection.clear();

    // Only load when both class + exam type are set. Exam type is mandatory now.
    if (this.selectedClassId && this.selectedExamType) {
      this.loadReportCards();
    }
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.selectedExamType = '';
    this.students = [];
    this.reportCards = [];
    this.setFilteredCards([]);
    this.selection.clear();

    if (!this.selectedClassId) {
      this.sections = [];
      this.examTypes = [];
      return;
    }

    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];

    // Auto-pick the FIRST section. The "All Sections" option is
    // commented out in the template, so leaving the picker empty would
    // leave a blank dropdown and no data on screen until the admin
    // opened it manually. The cascade (onSectionChange + recomputeExamTypes)
    // runs through the same handler the dropdown would have triggered.
    if (this.sections.length > 0) {
      this.selectedSectionId = this.sections[0].sectionId;
      this.onSectionChange();
    } else {
      // Class has no sections configured — nothing to land on, narrow
      // exam types against the class-only scope.
      this.recomputeExamTypes();
    }
  }

  onSectionChange(): void {
    this.selectedStudentId = '';
    // Re-derive exam types: section scope may have a different set of conducted exams
    const previousType = this.selectedExamType;
    this.recomputeExamTypes();
    // If the previously-picked type is no longer valid for this section, clear it
    if (previousType && !this.examTypes.includes(previousType)) {
      this.selectedExamType = '';
      this.reportCards = [];
      this.setFilteredCards([]);
    }
    this.selection.clear();

    // Refresh the student picker for the new section.
    if (this.selectedSectionId) {
      this.loadStudentsForSection();
    } else {
      this.students = [];
    }

    // Section is now a SERVER filter — the bulk endpoint returns only
    // the picked section's report cards. Filtering the previous
    // response in memory would always return zero when switching A→B
    // because reportCards only ever contains the section we last
    // fetched. Re-fire the request when every required filter is set.
    if (this.selectedClassId && this.selectedExamType) {
      this.loadReportCards();
    } else {
      this.setFilteredCards([]);
    }
  }

  onStudentChange(): void {
    this.selection.clear();
    if (this.selectedStudentId) {
      this.setFilteredCards(this.reportCards.filter(rc => rc.studentId === this.selectedStudentId));
    } else if (this.selectedSectionId) {
      this.setFilteredCards(this.reportCards.filter(rc => {
        const student = this.studentMap[rc.studentId];
        return student && student.sectionId === this.selectedSectionId;
      }));
    } else {
      this.setFilteredCards([...this.reportCards]);
    }
  }

  private loadStudentsForSection(): void {
    this.api.getStudents(0, 200, {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId,
    }).subscribe((res) => {
      this.students = res.data?.content || [];
    });
  }

  loadReportCards(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId || !this.selectedExamType) return;
    this.isLoading = true;
    this.selection.clear();

    // Load all students for mapping
    this.api.getStudents(0, 200, { classId: this.selectedClassId }).subscribe({
      next: (res) => {
        const studentList = res.data?.content || [];
        studentList.forEach((s: any) => { this.studentMap[s.studentId] = s; });
      },
    });

    // Generate report cards. sectionId is pushed to the backend so the
    // bulk endpoint only processes students in the picked section —
    // turns 200 cards (4 sections × 50) into ~50.
    this.api.generateReportCards({
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId || undefined,
      academicYearId: this.selectedAcademicYearId,
      studentIds: [],
      examType: this.selectedExamType,
    }).subscribe({
      next: (res) => {
        this.reportCards = res.data || [];
        // Backend's bulk endpoint returns the whole class's report
        // cards — apply the currently-picked section filter on the
        // client side so the table doesn't silently widen to every
        // section the moment the bulk response lands.
        let initial = [...this.reportCards];
        if (this.selectedSectionId) {
          // studentMap may still be loading in parallel; rows whose
          // student we haven't resolved yet are kept (they'll filter
          // out on the next pass once the map fills in). The bigger
          // risk is the OTHER way — silently widening the table.
          initial = initial.filter(rc => {
            const student = this.studentMap[rc.studentId];
            return !student || student.sectionId === this.selectedSectionId;
          });
        }
        this.setFilteredCards(initial);
        // Pull the students-for-section list so the Student dropdown
        // is populated even when the admin lands here from the
        // class-then-exam-type path.
        if (this.selectedSectionId && this.students.length === 0) {
          this.loadStudentsForSection();
        }
        this.isLoading = false;
        if (this.reportCards.length === 0) {
          this.snackBar.open('No students found with exam marks', 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to generate report cards', 'Close', { duration: 3000 });
      },
    });
  }

  getRollNumber(rc: any): string {
    const student = this.studentMap[rc.studentId];
    return student?.rollNumber || student?.admissionNumber || '-';
  }

  // ── Selection ──────────────────────────────────────────────

  isAllSelected(): boolean {
    return this.selection.selected.length === this.filteredReportCards.length && this.filteredReportCards.length > 0;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.filteredReportCards);
    }
  }

  // ── Actions ────────────────────────────────────────────────

  viewReportCard(rc: any): void {
    this.router.navigate(['/report-cards', rc.studentId], {
      queryParams: {
        examType: this.selectedExamType,
        academicYearId: this.selectedAcademicYearId,
      },
    });
  }

  downloadPdf(rc: ReportCard): void {
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';
    this.api.downloadReportCardPdf(rc.studentId, this.selectedAcademicYearId, tenantId, this.selectedExamType).subscribe({
      next: (blob) => {
        // Capacitor-safe: anchor-click silently no-ops in the Android
        // WebView; the helper routes via base64 + window.open in that
        // case, falling through to the standard anchor-click in
        // desktop browsers.
        downloadOrOpenBlob(blob, `report-card-${rc.studentName || rc.studentId}.pdf`);
      },
      error: () => {
        this.snackBar.open('Failed to download PDF', 'Close', { duration: 3000 });
      },
    });
  }

  downloadAllPdfs(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    if (this.filteredReportCards.length === 0) return;

    this.isDownloadingAll = true;
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';
    const cards = [...this.filteredReportCards];
    let completed = 0;
    let failed = 0;

    const downloadNext = (index: number) => {
      if (index >= cards.length) {
        this.isDownloadingAll = false;
        const msg = failed > 0
          ? `Downloaded ${completed} PDFs, ${failed} failed`
          : `Downloaded ${completed} PDFs`;
        this.snackBar.open(msg, 'Close', { duration: 3000 });
        return;
      }
      const rc = cards[index];
      this.api.downloadReportCardPdf(rc.studentId, this.selectedAcademicYearId, tenantId, this.selectedExamType).subscribe({
        next: (blob) => {
          downloadOrOpenBlob(blob, `report-card-${rc.studentName || rc.studentId}.pdf`);
          completed++;
          setTimeout(() => downloadNext(index + 1), 300);
        },
        error: () => {
          failed++;
          setTimeout(() => downloadNext(index + 1), 300);
        },
      });
    };

    downloadNext(0);
  }
}
