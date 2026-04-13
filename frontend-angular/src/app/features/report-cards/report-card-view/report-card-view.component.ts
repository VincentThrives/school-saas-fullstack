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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

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
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './report-card-view.component.html',
  styleUrl: './report-card-view.component.scss',
})
export class ReportCardViewComponent implements OnInit {
  reportCard: any = null;
  marksColumns = ['subjectName', 'marksObtained', 'maxMarks', 'grade'];
  isLoading = false;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('reportCardId') || '';
    if (id) {
      this.loadReportCard(id);
    }
  }

  loadReportCard(studentId: string): void {
    this.isLoading = true;
    this.api.getAcademicYears().subscribe({
      next: (ayRes) => {
        const years = Array.isArray(ayRes.data) ? ayRes.data : (ayRes.data as any)?.content || [];
        const current = years.find((y: any) => y.current);
        const academicYearId = current?.academicYearId || (years.length > 0 ? years[0].academicYearId : '');

        if (!academicYearId) {
          this.isLoading = false;
          this.snackBar.open('No academic year found', 'Close', { duration: 3000 });
          return;
        }

        this.api.getStudentReportCard(studentId, academicYearId).subscribe({
          next: (res) => {
            if (res.success && res.data) {
              this.reportCard = res.data;
            }
            this.isLoading = false;
          },
          error: (err) => {
            this.isLoading = false;
            this.snackBar.open(err?.error?.message || 'Failed to load report card', 'Close', { duration: 3000 });
          },
        });
      },
    });
  }

  downloadPdf(): void {
    if (!this.reportCard) return;
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';
    this.api.downloadReportCardPdf(this.reportCard.studentId, this.reportCard.academicYearId, tenantId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-card-${this.reportCard.studentName || 'student'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('Failed to download PDF', 'Close', { duration: 3000 });
      },
    });
  }
}
