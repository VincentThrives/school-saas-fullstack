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

    this.isLoading = true;
    this.reportLoaded = false;

    this.api.getClassAttendanceReport(this.selectedClassId, this.selectedSectionId, this.startDate, this.endDate).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.processReport(res.data);
          this.reportLoaded = true;
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
    const students: any[] = data.students || [];

    // Maps: subjectId -> aggregated counts
    const subjectMap = new Map<string, { subjectName: string; present: number; absent: number; late: number; totalRecords: number }>();
    // Maps: studentId+subjectId -> per-student per-subject counts
    const studentSubjectMap = new Map<string, StudentSubjectReport>();
    // Student name map (from records)
    const studentNameMap = new Map<string, { name: string; rollNumber: string }>();

    for (const student of students) {
      const studentId = student.studentId;
      const records: any[] = student.records || student.attendance || [];

      // Try to get student name from the student object itself
      const studentName = student.studentName || student.name || studentId;
      const rollNumber = student.rollNumber || '-';
      studentNameMap.set(studentId, { name: studentName, rollNumber });

      for (const record of records) {
        const subjectId = record.subjectId;
        if (!subjectId) continue; // skip records without subject

        const subjectName = record.subjectName || this.subjectService.getSubjectName(subjectId);
        const status = (record.status || '').toUpperCase();

        // Aggregate by subject
        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, { subjectName, present: 0, absent: 0, late: 0, totalRecords: 0 });
        }
        const subj = subjectMap.get(subjectId)!;
        subj.totalRecords++;
        if (status === 'PRESENT') subj.present++;
        else if (status === 'ABSENT') subj.absent++;
        else if (status === 'LATE') subj.late++;

        // Per student per subject
        const key = `${studentId}_${subjectId}`;
        if (!studentSubjectMap.has(key)) {
          studentSubjectMap.set(key, {
            studentId,
            studentName,
            rollNumber,
            subjectId,
            subjectName,
            present: 0,
            absent: 0,
            late: 0,
            total: 0,
            percentage: 0,
          });
        }
        const ss = studentSubjectMap.get(key)!;
        ss.total++;
        if (status === 'PRESENT') ss.present++;
        else if (status === 'ABSENT') ss.absent++;
        else if (status === 'LATE') ss.late++;
      }
    }

    // Build subject summary
    this.subjectReports = Array.from(subjectMap.entries()).map(([subjectId, s]) => ({
      subjectId,
      subjectName: s.subjectName,
      totalClasses: s.totalRecords,
      present: s.present,
      absent: s.absent,
      late: s.late,
      presentPercent: s.totalRecords > 0 ? Math.round((s.present / s.totalRecords) * 100) : 0,
    }));

    // Build student-subject detail
    this.studentSubjectReports = Array.from(studentSubjectMap.values()).map((ss) => ({
      ...ss,
      percentage: ss.total > 0 ? Math.round((ss.present / ss.total) * 100) : 0,
    }));

    // Build subjects filter list
    this.subjects = this.subjectReports.map((s) => ({ subjectId: s.subjectId, subjectName: s.subjectName }));
    this.selectedSubjectFilter = '';
    this.applySubjectFilter();

    // Resolve student names from API
    this.api.getStudents(0, 100, {}).subscribe({
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
