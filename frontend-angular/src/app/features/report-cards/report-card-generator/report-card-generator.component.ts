import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { SelectionModel } from '@angular/cdk/collections';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear, ReportCard } from '../../../core/models';

@Component({
  selector: 'app-report-card-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    PageHeaderComponent,
  ],
  templateUrl: './report-card-generator.component.html',
  styleUrl: './report-card-generator.component.scss',
})
export class ReportCardGeneratorComponent implements OnInit {
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  selectedClassId = '';
  selectedAcademicYearId = '';

  reportCards: ReportCard[] = [];
  displayedColumns = ['select', 'studentName', 'rollNumber', 'percentage', 'grade', 'rank', 'actions'];
  selection = new SelectionModel<ReportCard>(true, []);
  isLoading = false;
  isGenerating = false;

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.isCurrent);
      if (current) this.selectedAcademicYearId = current.id;
    });
  }

  loadReportCards(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.selection.clear();
    this.api.getReportCards(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.reportCards = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  isAllSelected(): boolean {
    return this.selection.selected.length === this.reportCards.length && this.reportCards.length > 0;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.reportCards);
    }
  }

  generateReportCards(): void {
    if (this.selection.isEmpty()) return;
    this.isGenerating = true;
    const studentIds = this.selection.selected.map((rc) => rc.studentId);
    this.api.generateReportCards({
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      studentIds,
    }).subscribe({
      next: () => {
        this.isGenerating = false;
        this.loadReportCards();
      },
      error: () => {
        this.isGenerating = false;
      },
    });
  }

  downloadPdf(reportCardId: string): void {
    this.api.downloadReportCardPdf(reportCardId).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${reportCardId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  viewReportCard(reportCardId: string): void {
    this.router.navigate(['/report-cards', reportCardId]);
  }
}
