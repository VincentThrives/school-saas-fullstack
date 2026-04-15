import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear, Student } from '../../../core/models';

@Component({
  selector: 'app-bulk-promote',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './bulk-promote.component.html',
  styleUrl: './bulk-promote.component.scss',
})
export class BulkPromoteComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  allClasses: SchoolClass[] = [];

  // FROM
  fromAcademicYearId = '';
  fromClasses: SchoolClass[] = [];
  fromClassId = '';
  fromSections: { sectionId: string; name: string }[] = [];
  fromSectionId = '';

  // TO
  toAcademicYearId = '';
  toClasses: SchoolClass[] = [];
  toClassId = '';
  toSections: { sectionId: string; name: string }[] = [];
  toSectionId = '';

  // Students
  students: (Student & { selected: boolean })[] = [];
  isLoadingStudents = false;
  studentsLoaded = false;
  isPromoting = false;
  promotionDone = false;
  promotedCount = 0;
  skippedCount = 0;

  displayedColumns = ['select', 'rollNumber', 'name', 'admissionNumber'];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = Array.isArray(res.data) ? res.data : [];
      },
    });
    this.api.getClasses().subscribe({
      next: (res) => {
        this.allClasses = Array.isArray(res.data) ? res.data : [];
      },
    });
  }

  // Filter TO academic years: only years after FROM year
  get toAcademicYearOptions(): any[] {
    if (!this.fromAcademicYearId) return [];
    const fromYear = this.academicYears.find(y => y.academicYearId === this.fromAcademicYearId);
    if (!fromYear) return [];
    // Compare by label (e.g., "2025-2026" < "2026-2027")
    return this.academicYears.filter(y => y.label > fromYear.label);
  }

  // Filter TO classes: exclude the FROM class (only higher/different classes)
  get toClassOptions(): any[] {
    if (!this.fromClassId) return this.toClasses;
    const fromCls = this.fromClasses.find(c => c.classId === this.fromClassId);
    if (!fromCls) return this.toClasses;
    const fromNum = this.extractClassNumber(fromCls.name);
    return this.toClasses.filter(c => {
      const toNum = this.extractClassNumber(c.name);
      return toNum > fromNum;
    });
  }

  private extractClassNumber(name: string): number {
    const match = String(name).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  onFromYearChange(): void {
    this.fromClasses = this.allClasses.filter(c => c.academicYearId === this.fromAcademicYearId);
    this.fromClassId = '';
    this.fromSectionId = '';
    this.fromSections = [];
    // Reset TO side
    this.toAcademicYearId = '';
    this.toClassId = '';
    this.toSectionId = '';
    this.toClasses = [];
    this.toSections = [];
    this.students = [];
    this.studentsLoaded = false;
    this.promotionDone = false;
  }

  onFromClassChange(): void {
    const cls = this.fromClasses.find(c => c.classId === this.fromClassId);
    this.fromSections = cls?.sections || [];
    this.fromSectionId = '';
    // Reset TO class/section
    this.toClassId = '';
    this.toSectionId = '';
    this.toSections = [];
    this.students = [];
    this.studentsLoaded = false;
    this.promotionDone = false;
    if (this.fromSections.length === 1) {
      this.fromSectionId = this.fromSections[0].sectionId;
    }
  }

  onFromSectionChange(): void {
    this.students = [];
    this.studentsLoaded = false;
    this.promotionDone = false;
  }

  onToYearChange(): void {
    this.toClasses = this.allClasses.filter(c => c.academicYearId === this.toAcademicYearId);
    this.toClassId = '';
    this.toSectionId = '';
    this.toSections = [];
    this.promotionDone = false;
  }

  onToClassChange(): void {
    const cls = this.toClasses.find(c => c.classId === this.toClassId);
    this.toSections = cls?.sections || [];
    this.toSectionId = '';
    this.promotionDone = false;
    if (this.toSections.length === 1) {
      this.toSectionId = this.toSections[0].sectionId;
    }
  }

  loadStudents(): void {
    if (!this.fromClassId || !this.fromSectionId) return;
    this.isLoadingStudents = true;
    this.api.getStudents(0, 500, { classId: this.fromClassId, sectionId: this.fromSectionId }).subscribe({
      next: (res) => {
        const list = res.data?.content || [];
        this.students = list.map((s: any) => ({
          ...s,
          selected: true,
        }));
        this.studentsLoaded = true;
        this.isLoadingStudents = false;
      },
      error: () => {
        this.studentsLoaded = true;
        this.isLoadingStudents = false;
        this.snackBar.open('Failed to load students', 'Close', { duration: 3000 });
      },
    });
  }

  get selectedCount(): number {
    return this.students.filter(s => s.selected).length;
  }

  get excludedCount(): number {
    return this.students.filter(s => !s.selected).length;
  }

  toggleAll(checked: boolean): void {
    this.students.forEach(s => s.selected = checked);
  }

  get allSelected(): boolean {
    return this.students.length > 0 && this.students.every(s => s.selected);
  }

  get canPromote(): boolean {
    return !!this.fromClassId && !!this.fromSectionId &&
           !!this.toClassId && !!this.toSectionId &&
           !!this.toAcademicYearId &&
           this.selectedCount > 0 && !this.isPromoting;
  }

  getFromClassName(): string {
    return this.fromClasses.find(c => c.classId === this.fromClassId)?.name || '';
  }

  getFromSectionName(): string {
    return this.fromSections.find(s => s.sectionId === this.fromSectionId)?.name || '';
  }

  getToClassName(): string {
    return this.toClasses.find(c => c.classId === this.toClassId)?.name || '';
  }

  getToSectionName(): string {
    return this.toSections.find(s => s.sectionId === this.toSectionId)?.name || '';
  }

  getToYearLabel(): string {
    return this.academicYears.find(y => y.academicYearId === this.toAcademicYearId)?.label || '';
  }

  promote(): void {
    if (!this.canPromote) return;

    // Check if FROM academic year has ended
    const fromYear = this.academicYears.find(y => y.academicYearId === this.fromAcademicYearId);
    if (fromYear?.endDate) {
      const endDate = new Date(fromYear.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (endDate > today) {
        this.snackBar.open(
          `Academic year "${fromYear.label}" has not completed yet (ends on ${fromYear.endDate}). Promotion is allowed only after the academic year ends.`,
          'Close', { duration: 6000 }
        );
        return;
      }
    }

    const excludedIds = this.students.filter(s => !s.selected).map(s => s.studentId);

    this.isPromoting = true;
    this.api.bulkPromoteStudents({
      fromClassId: this.fromClassId,
      fromSectionId: this.fromSectionId,
      toClassId: this.toClassId,
      toSectionId: this.toSectionId,
      toAcademicYearId: this.toAcademicYearId,
      excludedStudentIds: excludedIds.length > 0 ? excludedIds : undefined,
    }).subscribe({
      next: (res) => {
        this.isPromoting = false;
        this.promotionDone = true;
        this.promotedCount = res.data?.promoted || 0;
        this.skippedCount = res.data?.skipped || 0;
        this.snackBar.open(
          `Promoted ${this.promotedCount} students, skipped ${this.skippedCount}`,
          'Close', { duration: 5000 }
        );
      },
      error: (err) => {
        this.isPromoting = false;
        this.snackBar.open(err?.error?.message || 'Promotion failed', 'Close', { duration: 5000 });
      },
    });
  }
}
