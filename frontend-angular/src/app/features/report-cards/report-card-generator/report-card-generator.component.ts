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
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './report-card-generator.component.html',
  styleUrl: './report-card-generator.component.scss',
})
export class ReportCardGeneratorComponent implements OnInit {
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  selectedClassId = '';
  selectedAcademicYearId = '';

  reportCards: any[] = [];
  studentMap: Record<string, any> = {};
  displayedColumns = ['select', 'studentName', 'rollNumber', 'percentage', 'grade', 'rank', 'actions'];
  selection = new SelectionModel<any>(true, []);
  isLoading = false;
  isGenerating = false;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) this.selectedAcademicYearId = current.academicYearId;
    });
  }

  loadReportCards(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.selection.clear();

    // Load students for roll numbers
    this.api.getStudents(0, 100).subscribe({
      next: (res) => {
        const students = res.data?.content || [];
        students.forEach((s: any) => { this.studentMap[s.studentId] = s; });
      },
    });

    // Generate report cards for the class
    this.api.generateReportCards({
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      studentIds: [],
    }).subscribe({
      next: (res) => {
        this.reportCards = res.data || [];
        this.isLoading = false;
        if (this.reportCards.length === 0) {
          this.snackBar.open('No students found with exam marks in this class', 'Close', { duration: 3000 });
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

  isAllSelected(): boolean {
    return this.selection.selected.length === this.reportCards.length && this.reportCards.length > 0;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.reportCards);
    }
  }

  generateReportCards(): void {
    if (this.selection.isEmpty()) return;
    this.isGenerating = true;
    const studentIds = this.selection.selected.map((rc) => rc.studentId);
    this.api.generateReportCards({
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      studentIds,
    }).subscribe({
      next: () => {
        this.isGenerating = false;
        this.loadReportCards();
      },
      error: () => {
        this.isGenerating = false;
      },
    });
  }

  downloadPdf(rc: ReportCard): void {
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';
    this.api.downloadReportCardPdf(rc.studentId, this.selectedAcademicYearId, tenantId).subscribe({
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

  viewReportCard(rc: any): void {
    this.router.navigate(['/report-cards', rc.id || rc.reportCardId || rc.studentId]);
  }
}
