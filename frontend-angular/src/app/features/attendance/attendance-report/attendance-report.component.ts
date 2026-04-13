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

    // Use the class attendance report endpoint which groups by student
    this.api.getClassAttendanceReport(this.selectedClassId, this.selectedSectionId, this.startDate, this.endDate).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const data = res.data;

          this.summaryData = {
            totalStudents: data.totalStudents || 0,
            presentPercent: data.presentPercent || 0,
            absentPercent: data.absentPercent || 0,
            latePercent: data.latePercent || 0,
          };

          this.studentReports = (data.students || []).map((s: any) => ({
            studentId: s.studentId,
            studentName: s.studentId,
            rollNumber: '-',
            present: s.present || 0,
            absent: s.absent || 0,
            late: s.late || 0,
            halfDay: s.halfDay || 0,
            total: s.totalDays || 0,
            percentage: s.percentage || 0,
          }));

          // Load student names separately
          this.api.getStudents(0, 100, {}).subscribe({
            next: (studentsRes) => {
              const allStudents = studentsRes.data?.content || [];
              const nameMap: Record<string, any> = {};
              allStudents.forEach((st: any) => { nameMap[st.studentId] = st; });

              this.studentReports.forEach(r => {
                const st = nameMap[r.studentId];
                if (st) {
                  r.studentName = st.firstName ? `${st.firstName} ${st.lastName || ''}`.trim() : `Student ${st.admissionNumber || ''}`;
                  r.rollNumber = st.rollNumber || st.admissionNumber || '-';
                }
              });
            },
          });

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

  getPercentageColor(percentage: number): string {
    if (percentage >= 90) return '#4caf50';
    if (percentage >= 75) return '#2196f3';
    if (percentage >= 60) return '#ff9800';
    return '#f44336';
  }
}
