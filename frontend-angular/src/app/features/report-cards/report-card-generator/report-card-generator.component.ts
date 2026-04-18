import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { SelectionModel } from '@angular/cdk/collections';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SchoolClass, AcademicYear, ReportCard } from '../../../core/models';

@Component({
  selector: 'app-report-card-generator',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatSelectModule, MatFormFieldModule,
    MatTableModule, MatCheckboxModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule, MatSnackBarModule, PageHeaderComponent,
  ],
  templateUrl: './report-card-generator.component.html',
  styleUrl: './report-card-generator.component.scss',
})
export class ReportCardGeneratorComponent implements OnInit {
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

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

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
    this.filteredReportCards = [];
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
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.students = [];
    this.reportCards = [];
    this.filteredReportCards = [];
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
    this.filteredReportCards = [];
    this.selection.clear();

    if (!this.selectedClassId) {
      this.sections = [];
      this.examTypes = [];
      return;
    }

    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];

    // Narrow the exam-type options to the types that exist for this class.
    this.recomputeExamTypes();
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
      this.filteredReportCards = [];
    }
    this.selection.clear();

    // Filter report cards by section (existing behavior)
    if (this.selectedSectionId) {
      this.loadStudentsForSection();
      this.filteredReportCards = this.reportCards.filter(rc => {
        const student = this.studentMap[rc.studentId];
        return student && student.sectionId === this.selectedSectionId;
      });
    } else {
      this.students = [];
      this.filteredReportCards = [...this.reportCards];
    }
  }

  onStudentChange(): void {
    this.selection.clear();
    if (this.selectedStudentId) {
      this.filteredReportCards = this.reportCards.filter(rc => rc.studentId === this.selectedStudentId);
    } else if (this.selectedSectionId) {
      this.filteredReportCards = this.reportCards.filter(rc => {
        const student = this.studentMap[rc.studentId];
        return student && student.sectionId === this.selectedSectionId;
      });
    } else {
      this.filteredReportCards = [...this.reportCards];
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

    // Generate report cards — exam type is always passed now
    this.api.generateReportCards({
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      studentIds: [],
      examType: this.selectedExamType,
    }).subscribe({
      next: (res) => {
        this.reportCards = res.data || [];
        this.filteredReportCards = [...this.reportCards];
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
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-card-${rc.studentName || rc.studentId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
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
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `report-card-${rc.studentName || rc.studentId}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
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
