import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass } from '../../../core/models';

@Component({
  selector: 'app-classes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './classes-list.component.html',
  styleUrl: './classes-list.component.scss',
})
export class ClassesListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'sections', 'academicYear', 'students', 'actions'];
  dataSource = new MatTableDataSource<SchoolClass>([]);
  isLoading = false;

  deleteDialogOpen = false;
  selectedClass: SchoolClass | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  loadClasses(): void {
    this.isLoading = true;
    this.apiService.getClasses().subscribe({
      next: (response) => {
        this.dataSource.data = response.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  navigateToAddClass(): void {
    this.router.navigate(['/classes/new']);
  }

  editClass(schoolClass: SchoolClass): void {
    this.router.navigate(['/classes', schoolClass.classId, 'edit']);
  }

  confirmDelete(schoolClass: SchoolClass): void {
    this.selectedClass = schoolClass;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedClass = null;
  }

  deleteClass(): void {
    if (!this.selectedClass) return;
    this.deleteDialogOpen = false;
    this.selectedClass = null;
    this.loadClasses();
  }

  getSectionsCount(schoolClass: SchoolClass): number {
    return schoolClass.sections?.length || 0;
  }

  getSectionNames(schoolClass: SchoolClass): string[] {
    return schoolClass.sections?.map(s => s.name) || [];
  }

  getTotalStudents(schoolClass: SchoolClass): number {
    return schoolClass.sections?.reduce((sum, s) => sum + (s.capacity || 0), 0) || 0;
  }
}
