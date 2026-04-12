import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { ReportCard } from '../../../core/models';

@Component({
  selector: 'app-report-card-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './report-card-view.component.html',
  styleUrl: './report-card-view.component.scss',
})
export class ReportCardViewComponent implements OnInit {
  reportCard: ReportCard | null = null;
  marksColumns = ['subjectName', 'maxMarks', 'obtainedMarks', 'grade'];
  isLoading = false;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('reportCardId');
    if (id) {
      this.loadReportCard(id);
    }
  }

  loadReportCard(id: string): void {
    this.isLoading = true;
    this.api.getReportCardById(id).subscribe({
      next: (res) => {
        this.reportCard = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  downloadPdf(): void {
    if (!this.reportCard) return;
    this.api.downloadReportCardPdf(this.reportCard.reportCardId).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${this.reportCard!.studentName}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }
}
