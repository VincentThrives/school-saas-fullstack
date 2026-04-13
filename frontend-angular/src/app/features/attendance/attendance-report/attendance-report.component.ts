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
import { SchoolClass } from '../../../core/models';
import { forkJoin } from 'rxjs';

interface StudentReport {
  studentId: string;
  studentName: string;
  rollNumber: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
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
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    PageHeaderComponent,
    StatCardComponent,
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

  summaryData = {
    totalStudents: 0,
    presentPercent: 0,
    absentPercent: 0,
    latePercent: 0,
  };

  studentReports: StudentReport[] = [];
  displayedColumns = ['rollNumber', 'studentName', 'present', 'absent', 'late', 'total', 'percentage'];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {
    // Default: current month
    const now = new Date();
    this.startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    this.endDate = now.toISOString().split('T')[0];
  }

  ngOnInit(): void {
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

    // Load students for this class/section
    this.api.getStudents(0, 100, { classId: this.selectedClassId, sectionId: this.selectedSectionId }).subscribe({
      next: (studentsRes) => {
        const students = studentsRes.data?.content || [];

        if (students.length === 0) {
          this.isLoading = false;
          this.reportLoaded = true;
          this.studentReports = [];
          this.summaryData = { totalStudents: 0, presentPercent: 0, absentPercent: 0, latePercent: 0 };
          this.snackBar.open('No students found in this class/section', 'Close', { duration: 3000 });
          return;
        }

        // Load attendance summary for each student
        const requests = students.map((s: any) =>
          this.api.getStudentAttendanceSummary(s.studentId, this.startDate, this.endDate)
        );

        forkJoin(requests).subscribe({
          next: (results: any[]) => {
            let totalPresent = 0;
            let totalAbsent = 0;
            let totalLate = 0;
            let totalDays = 0;

            this.studentReports = students.map((s: any, i: number) => {
              const summary = results[i]?.data || {};
              const present = summary.present || 0;
              const absent = summary.absent || 0;
              const late = summary.late || 0;
              const halfDay = summary.halfDay || 0;
              const total = summary.totalDays || (present + absent + late + halfDay);
              const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

              totalPresent += present;
              totalAbsent += absent;
              totalLate += late;
              totalDays += total;

              return {
                studentId: s.studentId,
                studentName: s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : `Student ${s.admissionNumber || ''}`,
                rollNumber: s.rollNumber || s.admissionNumber || '-',
                present,
                absent,
                late,
                halfDay,
                total,
                percentage,
              };
            });

            this.summaryData = {
              totalStudents: students.length,
              presentPercent: totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0,
              absentPercent: totalDays > 0 ? Math.round((totalAbsent / totalDays) * 100) : 0,
              latePercent: totalDays > 0 ? Math.round((totalLate / totalDays) * 100) : 0,
            };

            this.reportLoaded = true;
            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
            this.snackBar.open('Failed to load attendance data', 'Close', { duration: 3000 });
          },
        });
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load students', 'Close', { duration: 3000 });
      },
    });
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 90) return '#4caf50';
    if (percentage >= 75) return '#2196f3';
    if (percentage >= 60) return '#ff9800';
    return '#f44336';
  }
}
