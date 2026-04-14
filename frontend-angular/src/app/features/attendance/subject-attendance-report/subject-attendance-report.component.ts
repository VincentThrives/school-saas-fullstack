import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';
import { SchoolClass } from '../../../core/models';

interface SubjectReport {
  subjectId: string;
  subjectName: string;
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  presentPercent: number;
}

interface StudentSubjectReport {
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectId: string;
  subjectName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

@Component({
  selector: 'app-subject-attendance-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    PageHeaderComponent,
    StatCardComponent,
  ],
  templateUrl: './subject-attendance-report.component.html',
  styleUrl: './subject-attendance-report.component.scss',
})
export class SubjectAttendanceReportComponent implements OnInit {
  classes: SchoolClass[] = [];
  sections: { name: string; capacity: number; sectionId: string }[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  startDate = '';
  endDate = '';
  isLoading = false;
  reportLoaded = false;

  subjectReports: SubjectReport[] = [];
  studentSubjectReports: StudentSubjectReport[] = [];
  filteredStudentReports: StudentSubjectReport[] = [];

  // Subject filter for the detailed table
  subjects: { subjectId: string; subjectName: string }[] = [];
  selectedSubjectFilter = '';

  displayedColumns = ['rollNumber', 'studentName', 'subjectName', 'present', 'absent', 'late', 'total', 'percentage'];

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private snackBar: MatSnackBar,
  ) {
    const now = new Date();
    this.startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    this.endDate = now.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.subjectService.loadSubjects();
    this.api.getClasses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.classes = Array.isArray(res.data) ? res.data : [];
        }
      },
    });
  }

  onClassChange(): void {
    const selectedClass = this.classes.find((c) => c.classId === this.selectedClassId);
    this.sections = selectedClass?.sections || [];
    this.selectedSectionId = '';
    this.reportLoaded = false;
  }

  loadReport(): void {
    if (!this.selectedClassId || !this.selectedSectionId) {
      this.snackBar.open('Please select class and section', 'Close', { duration: 3000 });
      return;
    }
    if (!this.startDate || !this.endDate) {
      this.snackBar.open('Please select date range', 'Close', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    this.reportLoaded = false;

    // Ensure dates are in YYYY-MM-DD format
    const fromDate = this.formatDateStr(this.startDate);
    const toDate = this.formatDateStr(this.endDate);

    // Use new batch report endpoint (reads from students_attendance collection)
    this.api.getBatchAttendanceReport(this.selectedClassId, this.selectedSectionId, fromDate, toDate).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const data = res.data;
          // Map batch response to subject report format
          const subjectSummaries = data.subjectSummaries || [];
          const studentDetails = data.periodWiseDetails || [];
          if (subjectSummaries.length > 0 || studentDetails.length > 0) {
            this.processSubjectReport({ subjectSummaries, studentDetails });
            this.reportLoaded = true;
          } else {
            this.reportLoaded = true;
            this.subjectReports = [];
            this.studentSubjectReports = [];
            this.filteredStudentReports = [];
            this.subjects = [];
            this.snackBar.open('No subject-wise attendance data found for the selected date range', 'Close', { duration: 3000 });
          }
        } else {
          this.snackBar.open('No subject-wise attendance data found', 'Close', { duration: 3000 });
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Subject attendance report error:', err);
        const msg = err?.error?.message || err?.statusText || 'Failed to load report';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
    });
  }

  private formatDateStr(date: any): string {
    if (!date) return '';
    if (date instanceof Date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Already a string like YYYY-MM-DD
    return String(date);
  }

  private processSubjectReport(data: any): void {
    // API returns: { subjectSummaries: [...], studentDetails: [...], totalSubjects, totalStudents }

    // Subject summaries from API
    this.subjectReports = (data.subjectSummaries || []).map((s: any) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName || this.subjectService.getSubjectName(s.subjectId),
      totalClasses: s.totalDays || 0,
      present: s.present || 0,
      absent: s.absent || 0,
      late: s.late || 0,
      presentPercent: s.presentPercent || 0,
    }));

    // Student-subject details from API
    this.studentSubjectReports = (data.studentDetails || []).map((d: any) => ({
      studentId: d.studentId,
      studentName: d.studentId,
      rollNumber: '-',
      subjectId: d.subjectId,
      subjectName: d.subjectName || this.subjectService.getSubjectName(d.subjectId),
      present: d.present || 0,
      absent: d.absent || 0,
      late: d.late || 0,
      total: d.totalDays || 0,
      percentage: d.percentage || 0,
    }));

    // Build subjects filter list
    this.subjects = this.subjectReports.map((s: any) => ({ subjectId: s.subjectId, subjectName: s.subjectName }));
    this.selectedSubjectFilter = '';
    this.applySubjectFilter();

    // Resolve student names — fetch students for this class/section
    this.api.getStudents(0, 200, { classId: this.selectedClassId, sectionId: this.selectedSectionId }).subscribe({
      next: (studentsRes) => {
        const allStudents = studentsRes.data?.content || [];
        const nameMap: Record<string, any> = {};
        allStudents.forEach((st: any) => { nameMap[st.studentId] = st; });

        this.studentSubjectReports.forEach((r) => {
          const st = nameMap[r.studentId];
          if (st) {
            r.studentName = st.firstName ? `${st.firstName} ${st.lastName || ''}`.trim() : `Student ${st.admissionNumber || ''}`;
            r.rollNumber = st.rollNumber || st.admissionNumber || '-';
          }
        });
        this.applySubjectFilter();
      },
    });
  }

  onSubjectFilterChange(): void {
    this.applySubjectFilter();
  }

  private applySubjectFilter(): void {
    if (this.selectedSubjectFilter) {
      this.filteredStudentReports = this.studentSubjectReports.filter(
        (r) => r.subjectId === this.selectedSubjectFilter
      );
    } else {
      this.filteredStudentReports = [...this.studentSubjectReports];
    }
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 90) return '#4caf50';
    if (percentage >= 75) return '#2196f3';
    if (percentage >= 60) return '#ff9800';
    return '#f44336';
  }

  getSubjectPercentClass(percent: number): string {
    if (percent >= 90) return 'percent-high';
    if (percent >= 75) return 'percent-good';
    if (percent >= 60) return 'percent-mid';
    return 'percent-low';
  }
}
