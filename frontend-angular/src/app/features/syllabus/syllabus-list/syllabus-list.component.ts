import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear, Syllabus } from '../../../core/models';

@Component({
  selector: 'app-syllabus-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './syllabus-list.component.html',
  styleUrl: './syllabus-list.component.scss',
})
export class SyllabusListComponent implements OnInit {
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  selectedClassId = '';
  selectedAcademicYearId = '';
  syllabusList: Syllabus[] = [];
  isLoading = false;

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
      const current = this.academicYears.find((ay) => ay.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.loadSyllabus();
      }
    });
  }

  loadSyllabus(): void {
    this.isLoading = true;
    const params: any = {};
    if (this.selectedClassId) params.classId = this.selectedClassId;
    if (this.selectedAcademicYearId) params.academicYearId = this.selectedAcademicYearId;
    this.api.getSyllabusList(params).subscribe({
      next: (res) => {
        this.syllabusList = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  viewDetail(syllabusId: string): void {
    this.router.navigate(['/syllabus', syllabusId]);
  }

  createSyllabus(): void {
    this.router.navigate(['/syllabus/new']);
  }
}
