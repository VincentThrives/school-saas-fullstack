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
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass } from '../../../core/models';

interface StudentReport {
  studentId: string;
  studentName: string;
  rollNumber: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

interface SubjectReport {
  subjectId: string;
  subjectName: string;
  present: number;
  absent: number;
  late: number;
  totalDays: number;
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
  selector: 'app-attendance-report',
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
    MatTabsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './attendance-report.component.html',
  styleUrl: './attendance-report.component.scss',
})
export class AttendanceReportComponent implements OnInit {
  classes: SchoolClass[] = [];
  sections: { name: string; capacity: number; sectionId: string }[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  startDate = '';
  endDate = '';
  isLoading = false;
  reportLoaded = false;
  attendanceMode = 'DAY_WISE'; // from super admin config

  // Day-wise
  dayWiseReports: StudentReport[] = [];
  dayColumns = ['rollNumber', 'studentName', 'present', 'absent', 'late', 'total', 'percentage'];

  // Period/Subject-wise
  subjectSummaries: SubjectReport[] = [];
  periodDetails: StudentSubjectReport[] = [];
  filteredPeriodDetails: StudentSubjectReport[] = [];
  selectedSubjectFilter = '';
  periodColumns = ['rollNumber', 'studentName', 'subjectName', 'present', 'absent', 'late', 'total', 'percentage'];

  totalStudents = 0;
  hasDayWise = false;
  hasPeriodWise = false;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {
    const now = new Date();
    this.startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    this.endDate = now.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
      },
    });
    this.api.getAttendanceMode().subscribe({
      next: (res) => {
        this.attendanceMode = res.data?.mode || 'DAY_WISE';
      },
    });
  }

  get isDayWiseMode(): boolean { return this.attendanceMode === 'DAY_WISE'; }
  get isSubjectWiseMode(): boolean { return this.attendanceMode === 'SUBJECT_WISE'; }

  onClassChange(): void {
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];
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

    this.api.getBatchAttendanceReport(this.selectedClassId, this.selectedSectionId, this.startDate, this.endDate).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.processReport(res.data);
          this.reportLoaded = true;
        } else {
          this.snackBar.open('No attendance data found', 'Close', { duration: 3000 });
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to load report', 'Close', { duration: 3000 });
      },
    });
  }

  private processReport(data: any): void {
    this.totalStudents = data.totalStudents || 0;
    this.hasDayWise = (data.totalDayRecords || 0) > 0;
    this.hasPeriodWise = (data.totalPeriodRecords || 0) > 0;

    // Day-wise
    this.dayWiseReports = (data.dayWiseStudents || []).map((s: any) => ({
      studentId: s.studentId,
      studentName: s.studentId,
      rollNumber: '-',
      present: s.present || 0,
      absent: s.absent || 0,
      late: s.late || 0,
      total: s.totalDays || 0,
      percentage: s.percentage || 0,
    }));

    // Subject summaries
    this.subjectSummaries = (data.subjectSummaries || []).map((s: any) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName || s.subjectId,
      present: s.present || 0,
      absent: s.absent || 0,
      late: s.late || 0,
      totalDays: s.totalDays || 0,
      presentPercent: s.presentPercent || 0,
    }));

    // Period details
    this.periodDetails = (data.periodWiseDetails || []).map((d: any) => ({
      studentId: d.studentId,
      studentName: d.studentId,
      rollNumber: '-',
      subjectId: d.subjectId,
      subjectName: d.subjectName || d.subjectId,
      present: d.present || 0,
      absent: d.absent || 0,
      late: d.late || 0,
      total: d.totalDays || 0,
      percentage: d.percentage || 0,
    }));
    this.selectedSubjectFilter = '';
    this.applySubjectFilter();

    // Resolve student names
    this.api.getStudents(0, 200, { classId: this.selectedClassId, sectionId: this.selectedSectionId }).subscribe({
      next: (studentsRes) => {
        const allStudents = studentsRes.data?.content || [];
        const nameMap: Record<string, any> = {};
        allStudents.forEach((st: any) => { nameMap[st.studentId] = st; });

        const resolve = (r: any) => {
          const st = nameMap[r.studentId];
          if (st) {
            r.studentName = st.firstName ? `${st.firstName} ${st.lastName || ''}`.trim() : `Student ${st.admissionNumber || ''}`;
            r.rollNumber = st.rollNumber || st.admissionNumber || '-';
          }
        };

        this.dayWiseReports.forEach(resolve);
        this.periodDetails.forEach(resolve);
        this.applySubjectFilter();
      },
    });
  }

  onSubjectFilterChange(): void {
    this.applySubjectFilter();
  }

  private applySubjectFilter(): void {
    if (this.selectedSubjectFilter) {
      this.filteredPeriodDetails = this.periodDetails.filter(r => r.subjectId === this.selectedSubjectFilter);
    } else {
      this.filteredPeriodDetails = [...this.periodDetails];
    }
  }

  getPercentageColor(pct: number): string {
    if (pct >= 90) return '#4caf50';
    if (pct >= 75) return '#2196f3';
    if (pct >= 60) return '#ff9800';
    return '#f44336';
  }
}
