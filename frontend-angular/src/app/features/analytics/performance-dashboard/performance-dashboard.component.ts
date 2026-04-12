import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, StudentPerformance } from '../../../core/models';

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    PageHeaderComponent,
  ],
  templateUrl: './performance-dashboard.component.html',
  styleUrl: './performance-dashboard.component.scss',
})
export class PerformanceDashboardComponent implements OnInit {
  classes: SchoolClass[] = [];
  students: { id: string; name: string }[] = [];
  selectedClassId = '';
  selectedStudentId = '';
  performance: StudentPerformance | null = null;
  isLoading = false;

  // Line chart - Performance Trend
  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Percentage',
      borderColor: '#D4A843',
      backgroundColor: 'rgba(212, 168, 67, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: {
      y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } },
    },
  };

  // Bar chart - Subject Analysis
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Average %',
      backgroundColor: 'rgba(212, 168, 67, 0.7)',
      borderColor: '#D4A843',
      borderWidth: 1,
    }],
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } },
    },
  };

  // Doughnut chart - Grade Distribution
  doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#D4A843', '#B8860B', '#FFD700', '#DAA520',
        '#F0E68C', '#BDB76B', '#808000', '#6B8E23',
      ],
    }],
  };

  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } },
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
    });
  }

  onClassChange(): void {
    if (this.selectedClassId) {
      this.api.getStudents(0, 200, { classId: this.selectedClassId }).subscribe((res) => {
        this.students = (res.data?.content || []).map((s: any) => ({
          id: s.studentId,
          name: `${s.rollNumber || ''} - ${s.userId}`,
        }));
      });
    }
  }

  loadPerformance(): void {
    if (!this.selectedStudentId) return;
    this.isLoading = true;
    this.api.getStudentPerformance(this.selectedStudentId).subscribe({
      next: (res) => {
        this.performance = res.data;
        this.updateCharts();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private updateCharts(): void {
    if (!this.performance) return;

    // Trend
    this.lineChartData = {
      ...this.lineChartData,
      labels: this.performance.trends.map((t) => t.examName),
      datasets: [{
        ...this.lineChartData.datasets[0],
        data: this.performance.trends.map((t) => t.percentage),
      }],
    };

    // Subject Analysis
    this.barChartData = {
      ...this.barChartData,
      labels: this.performance.subjectAnalysis.map((s) => s.subjectName),
      datasets: [{
        ...this.barChartData.datasets[0],
        data: this.performance.subjectAnalysis.map((s) => s.percentage),
      }],
    };

    // Grade Distribution
    this.doughnutChartData = {
      ...this.doughnutChartData,
      labels: this.performance.gradeDistribution.map((g) => g.grade),
      datasets: [{
        ...this.doughnutChartData.datasets[0],
        data: this.performance.gradeDistribution.map((g) => g.count),
      }],
    };
  }
}
