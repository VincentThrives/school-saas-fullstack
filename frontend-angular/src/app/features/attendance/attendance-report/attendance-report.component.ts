import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass } from '../../../core/models';

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
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    PageHeaderComponent,
    StatCardComponent,
  ],
  templateUrl: './attendance-report.component.html',
  styleUrl: './attendance-report.component.scss',
})
export class AttendanceReportComponent implements OnInit {
  classes: SchoolClass[] = [];
  sections: { name: string; capacity: number; sectionId?: string }[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  startDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  endDate: Date = new Date();
  isLoading = false;

  summaryData = {
    totalStudents: 0,
    presentPercent: 0,
    absentPercent: 0,
    latePercent: 0,
  };

  studentReports: StudentReport[] = [];
  displayedColumns = ['rollNumber', 'studentName', 'present', 'absent', 'late', 'halfDay', 'total', 'percentage'];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = res.data || [];
      },
    });
  }

  onClassChange(): void {
    const selectedClass = this.classes.find((c) => c.id === this.selectedClassId);
    this.sections = selectedClass?.sections || [];
    this.selectedSectionId = '';
  }

  loadReport(): void {
    if (!this.selectedClassId) return;

    this.isLoading = true;
    const month = this.formatMonth(this.startDate);

    this.api.getAttendanceSummary(this.selectedClassId, month).subscribe({
      next: (res) => {
        const data = res.data;
        if (data) {
          this.summaryData = {
            totalStudents: data.totalStudents || 0,
            presentPercent: data.presentPercent || 0,
            absentPercent: data.absentPercent || 0,
            latePercent: data.latePercent || 0,
          };
          this.studentReports = data.students || [];
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 90) return '#4caf50';
    if (percentage >= 75) return '#2196f3';
    if (percentage >= 60) return '#ff9800';
    return '#f44336';
  }

  private formatMonth(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
