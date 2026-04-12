import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartConfiguration } from 'chart.js';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { StudentPerformance } from '../../../core/models';

@Component({
  selector: 'app-student-report',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    PageHeaderComponent,
  ],
  templateUrl: './student-report.component.html',
  styleUrl: './student-report.component.scss',
})
export class StudentReportComponent implements OnInit {
  performance: StudentPerformance | null = null;
  subjectColumns = ['subjectName', 'averageMarks', 'maxMarks', 'percentage'];
  isLoading = false;

  trendChartData: ChartData<'line'> = {
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

  trendChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, max: 100 },
    },
  };

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('studentId');
    if (id) {
      this.loadReport(id);
    }
  }

  loadReport(studentId: string): void {
    this.isLoading = true;
    this.api.getStudentPerformance(studentId).subscribe({
      next: (res) => {
        this.performance = res.data;
        this.updateChart();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private updateChart(): void {
    if (!this.performance) return;
    this.trendChartData = {
      ...this.trendChartData,
      labels: this.performance.trends.map((t) => t.examName),
      datasets: [{
        ...this.trendChartData.datasets[0],
        data: this.performance.trends.map((t) => t.percentage),
      }],
    };
  }
}
