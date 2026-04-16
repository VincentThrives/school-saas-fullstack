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
    // Load exams first, then academic years — so exam types are ready when year auto-selects
    this.api.getExams().subscribe((res) => {
      this.allExams = res.data || [];

      this.api.getAcademicYears().subscribe((ayRes) => {
        this.academicYears = ayRes.data || [];
        const current = this.academicYears.find((ay) => ay.current);
        if (current) {
          this.selectedAcademicYearId = current.academicYearId;
          this.onAcademicYearChange();
        }
      });
    });
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
    this.selection.clear();

    if (!this.selectedAcademicYearId) {
      this.examTypes = [];
      return;
    }

    // Extract exam types for this academic year
    const examsForYear = this.allExams.filter((e: any) => e.academicYearId === this.selectedAcademicYearId);
    const types = new Set<string>();
    examsForYear.forEach((e: any) => { if (e.examType) types.add(e.examType); });
    this.examTypes = Array.from(types).sort();

    // Load classes for this year
    this.api.getClasses(this.selectedAcademicYearId).subscribe((res) => {
      this.classes = res.data || [];
    });
  }

  onExamTypeChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.sections = [];
    this.students = [];
    this.reportCards = [];
    this.filteredReportCards = [];
    this.selection.clear();
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.students = [];
    this.reportCards = [];
    this.filteredReportCards = [];
    this.selection.clear();

    if (!this.selectedClassId) {
      this.sections = [];
      return;
    }

    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];

    // Auto-load report cards if exam type is selected
    if (this.selectedExamType) {
      this.loadReportCards();
    }
  }

  onSectionChange(): void {
    this.selectedStudentId = '';
    this.selection.clear();

    // Filter report cards by section
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
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.selection.clear();

    // Load all students for mapping
    this.api.getStudents(0, 200, { classId: this.selectedClassId }).subscribe({
      next: (res) => {
        const studentList = res.data?.content || [];
        studentList.forEach((s: any) => { this.studentMap[s.studentId] = s; });
      },
    });

    // Generate report cards with exam type filter
    this.api.generateReportCards({
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      studentIds: [],
      examType: this.selectedExamType || undefined,
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
    this.router.navigate(['/report-cards', rc.studentId]);
  }

  downloadPdf(rc: ReportCard): void {
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';
    this.api.downloadReportCardPdf(rc.studentId, this.selectedAcademicYearId, tenantId, this.selectedExamType || undefined).subscribe({
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
    this.isDownloadingAll = true;
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';

    this.api.downloadAllReportCardPdfs(
      this.selectedClassId, this.selectedAcademicYearId, tenantId, this.selectedExamType || undefined
    ).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-cards-all.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isDownloadingAll = false;
        this.snackBar.open('All report cards downloaded', 'Close', { duration: 3000 });
      },
      error: () => {
        this.isDownloadingAll = false;
        this.snackBar.open('Failed to download all report cards', 'Close', { duration: 3000 });
      },
    });
  }
}
