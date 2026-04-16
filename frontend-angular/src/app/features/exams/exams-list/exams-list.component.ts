import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-exams-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
        // Auto-select current year
        const current = this.academicYears.find(y => y.current);
        if (current) {
          this.academicYearFilter = current.academicYearId;
          this.loadClassesForYear(current.academicYearId);
        }
      },
    });
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
  }

  onClassFilterChange(): void {
    this.sectionFilter = '';
    this.subjectFilter = '';
    this.subjectsList = [];
    const cls = this.classes.find(c => c.classId === this.classFilter);
    this.sections = cls?.sections || [];
  }

  onSectionFilterChange(): void {
    this.subjectFilter = '';
    this.subjectsList = [];
    if (!this.classFilter) return;
    const cls = this.classes.find(c => c.classId === this.classFilter);
    const sec = cls?.sections?.find(s => s.sectionId === this.sectionFilter);
    const subjectIds = sec?.subjectIds || [];
    if (subjectIds.length > 0) {
      this.subjectService.getSubjectsByIds(subjectIds).subscribe({
        next: (subs) => { this.subjectsList = subs.map(s => ({ subjectId: s.subjectId, name: s.name })); },
      });
    }
  }

  private loadClassesForYear(yearId: string): void {
    this.api.getClasses(yearId).subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        this.classes.forEach(cls => {
          this.classMap[cls.classId] = cls.name;
          (cls.sections || []).forEach(sec => {
            this.sectionMap[sec.sectionId] = sec.name;
          });
        });
      },
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
        this.exams = res.data || [];
        this.totalElements = this.exams.length;
        this.isLoading = false;
        this.exams.forEach(exam => {
          const examId = exam.examId || exam.id;
          this.api.getExamMarks(examId).subscribe({
            next: (marksRes) => {
              this.marksCountMap[examId] = (marksRes.data || []).length;
            },
          });
          // Resolve class name if not in map
          if (exam.classId && !this.classMap[exam.classId]) {
            this.classMap[exam.classId] = exam.className || exam.classId;
          }
        });
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  get filteredExams(): any[] {
    let result = this.exams;
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

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
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
