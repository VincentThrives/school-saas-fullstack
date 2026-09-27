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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    MatProgressSpinnerModule, MatSlideToggleModule, MatTooltipModule,
    MatSnackBarModule, MatDatepickerModule, MatNativeDateModule,
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
  /** Column set is dynamic — the "Hostel" column only appears when at
   *  least one row in the current view has hostelEnabled=true, so
   *  schools without a hostel never see a blank column full of dashes. */
  get displayedColumns(): string[] {
    const base = ['className', 'amount'];
    if (this.anyHostelConfigured) base.push('hostelAmount');
    base.push('dueDate', 'description', 'actions');
    return base;
  }

  get anyHostelConfigured(): boolean {
    return (this.structures || []).some(s => s?.hostelEnabled);
  }

  /** Classes the Add/Edit form can pick from. On Edit, only the class
   *  being edited (dropdown is disabled — a single option is enough). On
   *  Add, exclude classes that already have a fee structure — a duplicate
   *  would be rejected server-side anyway, and the ledger materialiser
   *  sums across rows so a duplicate silently doubles every student's fee. */
  get classesForFeeForm(): SchoolClass[] {
    if (this.editingId) {
      return this.classes.filter(c => c.classId === this.formData.classId);
    }
    return this.classes.filter(c => !this.takenClassIds.has(c.classId));
  }

  /** Label for the Hostel column — "Rs. 40,000" for single-fee classes,
   *  "Boys ₹40k · Girls ₹35k" when the class has a gender split. */
  hostelLabel(s: any): string {
    if (!s?.hostelEnabled) return '—';
    if (s.hostelGenderSplit) {
      const b = s.hostelBoysAmount || 0;
      const g = s.hostelGirlsAmount || 0;
      return `Boys Rs. ${b.toLocaleString('en-IN')} · Girls Rs. ${g.toLocaleString('en-IN')}`;
    }
    return `Rs. ${(s.hostelAmount || 0).toLocaleString('en-IN')}`;
  }
  isLoading = false;

  // Form
  formOpen = false;
  editingId: string | null = null;
  formData = {
    classId: '',
    amount: 0,
    dueDate: '',
    description: '',
    hostelEnabled: false,
    hostelGenderSplit: false,
    hostelAmount: 0,
    hostelBoysAmount: 0,
    hostelGirlsAmount: 0,
  };

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

  /** All classIds that already have a fee structure in the selected AY.
   *  Kept independent of the class filter so the Add-Fee dropdown can
   *  hide taken classes correctly even when the list is scoped. */
  private takenClassIds = new Set<string>();

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
    // Refresh the taken-classes set from the UNFILTERED list — the
    // scoped view above is what the user sees, but the Add-Fee dropdown
    // needs to know about every class taken across the whole year.
    this.api.getFeeStructures(this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.takenClassIds = new Set((res.data || []).map(s => s.classId).filter(Boolean));
      },
      error: () => { this.takenClassIds = new Set(); },
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
        hostelEnabled: !!structure.hostelEnabled,
        hostelGenderSplit: !!structure.hostelGenderSplit,
        hostelAmount: structure.hostelAmount || 0,
        hostelBoysAmount: structure.hostelBoysAmount || 0,
        hostelGirlsAmount: structure.hostelGirlsAmount || 0,
      };
    } else {
      this.editingId = null;
      this.formData = {
        classId: '', amount: 0, dueDate: '', description: '',
        hostelEnabled: false, hostelGenderSplit: false,
        hostelAmount: 0, hostelBoysAmount: 0, hostelGirlsAmount: 0,
      };
    }
    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
  }

  saveStructure(): void {
    // Only send the hostel amount fields relevant to the current toggle
    // state — keeps stale values from a disabled panel out of the payload.
    const payload: any = {
      academicYearId: this.selectedAcademicYearId,
      classId: this.formData.classId,
      amount: this.formData.amount,
      dueDate: this.formData.dueDate,
      description: this.formData.description,
      hostelEnabled: !!this.formData.hostelEnabled,
      hostelGenderSplit: this.formData.hostelEnabled && this.formData.hostelGenderSplit,
      hostelAmount: this.formData.hostelEnabled && !this.formData.hostelGenderSplit
        ? (this.formData.hostelAmount || 0) : 0,
      hostelBoysAmount: this.formData.hostelEnabled && this.formData.hostelGenderSplit
        ? (this.formData.hostelBoysAmount || 0) : 0,
      hostelGirlsAmount: this.formData.hostelEnabled && this.formData.hostelGenderSplit
        ? (this.formData.hostelGirlsAmount || 0) : 0,
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
