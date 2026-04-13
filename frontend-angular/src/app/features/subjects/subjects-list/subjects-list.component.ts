import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';

@Component({
  selector: 'app-subjects-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './subjects-list.component.html',
  styleUrl: './subjects-list.component.scss',
})
export class SubjectsListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'code', 'type', 'actions'];
  dataSource = new MatTableDataSource<SubjectItem>([]);
  isLoading = false;

  // Create dialog state
  createDialogOpen = false;
  newName = '';
  newCode = '';
  newType = 'Theory';
  isCreating = false;

  // Delete dialog state
  deleteDialogOpen = false;
  selectedSubject: SubjectItem | null = null;

  constructor(
    private subjectService: SubjectService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    this.isLoading = true;
    this.subjectService.getSubjects().subscribe({
      next: (subjects) => {
        this.dataSource.data = subjects;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  openCreateDialog(): void {
    this.newName = '';
    this.newCode = '';
    this.newType = 'THEORY';
    this.createDialogOpen = true;
  }

  closeCreateDialog(): void {
    this.createDialogOpen = false;
    this.newName = '';
    this.newCode = '';
    this.newType = 'THEORY';
  }

  createSubject(): void {
    if (!this.newName.trim()) {
      this.snackBar.open('Please enter a subject name', 'Close', { duration: 3000 });
      return;
    }

    this.isCreating = true;
    this.subjectService.createSubject({
      name: this.newName.trim(),
      code: this.newCode.trim() || undefined,
      type: this.newType,
    }).subscribe({
      next: () => {
        this.snackBar.open(`Subject "${this.newName}" created successfully`, 'Close', { duration: 3000 });
        this.closeCreateDialog();
        this.isCreating = false;
        // Reload after refresh
        setTimeout(() => this.loadSubjects(), 500);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to create subject';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
        this.isCreating = false;
      },
    });
  }

  confirmDelete(subject: SubjectItem): void {
    this.selectedSubject = subject;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedSubject = null;
  }

  deleteSubject(): void {
    if (!this.selectedSubject) return;
    const subjectId = this.selectedSubject.subjectId;
    const name = this.selectedSubject.name;
    this.deleteDialogOpen = false;
    this.selectedSubject = null;

    this.subjectService.deleteSubject(subjectId).subscribe({
      next: () => {
        this.snackBar.open(`"${name}" deleted successfully`, 'Close', { duration: 3000 });
        setTimeout(() => this.loadSubjects(), 500);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete subject', 'Close', { duration: 3000 });
      },
    });
  }

  getTypeClass(type?: string): string {
    switch (type?.toLowerCase()) {
      case 'practical': return 'type-practical';
      case 'elective': return 'type-elective';
      default: return 'type-theory';
    }
  }

  getTypeLabel(type?: string): string {
    if (!type) return 'Theory';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}
