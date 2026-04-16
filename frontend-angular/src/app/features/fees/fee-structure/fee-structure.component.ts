import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDatepickerModule, MatNativeDateModule,
    PageHeaderComponent,
  ],
  templateUrl: './fee-structure.component.html',
  styleUrl: './fee-structure.component.scss',
})
export class FeeStructureComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  structures: any[] = [];
  classMap: Record<string, string> = {};

  selectedAcademicYearId = '';
  selectedClassId = '';
  displayedColumns = ['className', 'amount', 'dueDate', 'description', 'actions'];
  isLoading = false;

  // Form
  formOpen = false;
  editingId: string | null = null;
  formData = { classId: '', amount: 0, dueDate: '', description: '' };

  // Delete
  deleteDialogOpen = false;
  selectedStructure: any = null;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((y: any) => y.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.loadClasses();
        this.loadStructures();
      }
    });
  }

  onAcademicYearChange(): void {
    this.selectedClassId = '';
    this.loadClasses();
    this.loadStructures();
  }

  loadClasses(): void {
    if (!this.selectedAcademicYearId) return;
    this.api.getClasses(this.selectedAcademicYearId).subscribe((res) => {
      this.classes = res.data || [];
      this.classes.forEach(c => this.classMap[c.classId] = c.name);
    });
  }

  loadStructures(): void {
    if (!this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.api.getFeeStructures(this.selectedAcademicYearId, this.selectedClassId || undefined).subscribe({
      next: (res) => {
        this.structures = res.data || [];
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  getClassName(classId: string): string {
    return this.classMap[classId] || classId;
  }

  openForm(structure?: any): void {
    if (structure) {
      this.editingId = structure.feeStructureId;
      this.formData = {
        classId: structure.classId,
        amount: structure.amount,
        dueDate: structure.dueDate || '',
        description: structure.description || '',
      };
    } else {
      this.editingId = null;
      this.formData = { classId: '', amount: 0, dueDate: '', description: '' };
    }
    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
  }

  saveStructure(): void {
    const payload: any = {
      academicYearId: this.selectedAcademicYearId,
      classId: this.formData.classId,
      amount: this.formData.amount,
      dueDate: this.formData.dueDate,
      description: this.formData.description,
    };

    const obs = this.editingId
      ? this.api.updateFeeStructure(this.editingId, payload)
      : this.api.createFeeStructure(payload);

    obs.subscribe({
      next: () => {
        this.snackBar.open(this.editingId ? 'Fee structure updated' : 'Fee structure created', 'Close', { duration: 3000 });
        this.closeForm();
        this.loadStructures();
      },
      error: () => {
        this.snackBar.open('Failed to save fee structure', 'Close', { duration: 3000 });
      },
    });
  }

  confirmDelete(structure: any): void {
    this.selectedStructure = structure;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedStructure = null;
  }

  deleteStructure(): void {
    if (!this.selectedStructure) return;
    const id = this.selectedStructure.feeStructureId;
    this.deleteDialogOpen = false;
    this.selectedStructure = null;

    this.api.deleteFeeStructure(id).subscribe({
      next: () => {
        this.snackBar.open('Fee structure deleted', 'Close', { duration: 3000 });
        this.loadStructures();
      },
      error: () => {
        this.snackBar.open('Failed to delete', 'Close', { duration: 3000 });
      },
    });
  }
}
