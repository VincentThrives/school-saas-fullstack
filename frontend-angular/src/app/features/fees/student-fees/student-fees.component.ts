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
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear, Student } from '../../../core/models';

@Component({
  selector: 'app-student-fees',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule, PageHeaderComponent,
  ],
  templateUrl: './student-fees.component.html',
  styleUrl: './student-fees.component.scss',
})
export class StudentFeesComponent implements OnInit {
  // Filters
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  sections: { sectionId: string; name: string }[] = [];
  students: Student[] = [];

  selectedAcademicYearId = '';
  selectedClassId = '';
  selectedSectionId = '';
  selectedStudentId = '';

  // Student search / roster
  studentSearch = '';
  isLoadingStudents = false;

  // Fee data
  feeDetails: any = null;
  isLoading = false;
  displayedColumns = ['paymentDate', 'amountPaid', 'paymentStatus', 'paymentMode', 'receiptNumber', 'remarks', 'actions'];

  // Payment form
  paymentFormOpen = false;
  editingPaymentId: string | null = null;
  paymentForm = {
    amountPaid: 0,
    paymentStatus: 'PARTIAL',
    paymentMode: 'CASH',
    paymentDate: '',
    remarks: '',
  };

  // Delete
  deleteDialogOpen = false;
  selectedPayment: any = null;

  paymentModes = ['CASH', 'ONLINE', 'CHEQUE', 'DD', 'OTHER'];
  paymentStatuses = ['PARTIAL', 'FULL'];

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((y: any) => y.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.loadClasses();
      }
    });
  }

  onAcademicYearChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.classes = [];
    this.sections = [];
    this.students = [];
    this.feeDetails = null;
    this.studentSearch = '';
    this.loadClasses();
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.students = [];
    this.feeDetails = null;
    this.studentSearch = '';
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];
  }

  /**
   * Once class + section are chosen, fetch the full roster so the admin can
   * see everyone in the table and either search or click a row.
   */
  onSectionChange(): void {
    this.selectedStudentId = '';
    this.feeDetails = null;
    this.studentSearch = '';
    if (this.selectedClassId && this.selectedSectionId) {
      this.loadStudents();
    } else {
      this.students = [];
    }
  }

  /** Narrowed list after applying the search box. Client-side, instant. */
  get filteredStudents(): Student[] {
    const q = (this.studentSearch || '').trim().toLowerCase();
    if (!q) return this.students;
    return this.students.filter((s) => {
      const name = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      const adm = (s.admissionNumber || '').toLowerCase();
      const roll = (s.rollNumber || '').toLowerCase();
      return name.includes(q) || adm.includes(q) || roll.includes(q);
    });
  }

  /** Click a row to open that student's fee details. */
  selectStudentRow(student: Student): void {
    if (!student?.studentId) return;
    this.selectedStudentId = student.studentId;
    if (this.selectedAcademicYearId) {
      this.loadFeeDetails();
    }
  }

  /** Return from the student's fee view back to the roster. */
  clearStudent(): void {
    this.selectedStudentId = '';
    this.feeDetails = null;
  }

  get selectedStudent(): Student | undefined {
    return this.students.find((s) => s.studentId === this.selectedStudentId);
  }

  loadClasses(): void {
    if (!this.selectedAcademicYearId) return;
    this.api.getClasses(this.selectedAcademicYearId).subscribe((res) => {
      this.classes = res.data || [];
    });
  }

  loadStudents(): void {
    this.isLoadingStudents = true;
    this.api.getStudents(0, 500, {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId,
    }).subscribe({
      next: (res) => {
        this.students = res.data?.content || [];
        this.isLoadingStudents = false;
      },
      error: () => {
        this.students = [];
        this.isLoadingStudents = false;
      },
    });
  }

  loadFeeDetails(): void {
    this.isLoading = true;
    this.api.getStudentFeeDetails(this.selectedStudentId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.feeDetails = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.feeDetails = null;
        this.isLoading = false;
      },
    });
  }

  getStudentName(student: Student): string {
    return `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.admissionNumber;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'status-paid';
      case 'PARTIAL': return 'status-partial';
      case 'OVERDUE': return 'status-overdue';
      case 'UNPAID': return 'status-unpaid';
      default: return '';
    }
  }

  // ── Payment Form ────────────────────────────────────────────

  openPaymentForm(payment?: any): void {
    if (payment) {
      this.editingPaymentId = payment.paymentId;
      this.paymentForm = {
        amountPaid: payment.amountPaid,
        paymentStatus: payment.paymentStatus || 'PARTIAL',
        paymentMode: payment.paymentMode || 'CASH',
        paymentDate: payment.paymentDate || '',
        remarks: payment.remarks || '',
      };
    } else {
      this.editingPaymentId = null;
      const today = new Date().toISOString().split('T')[0];
      this.paymentForm = { amountPaid: 0, paymentStatus: 'PARTIAL', paymentMode: 'CASH', paymentDate: today, remarks: '' };
    }
    this.paymentFormOpen = true;
  }

  closePaymentForm(): void {
    this.paymentFormOpen = false;
    this.editingPaymentId = null;
  }

  savePayment(): void {
    if (this.editingPaymentId) {
      this.api.updateFeePayment(this.editingPaymentId, this.paymentForm).subscribe({
        next: () => {
          this.snackBar.open('Payment updated', 'Close', { duration: 3000 });
          this.closePaymentForm();
          this.loadFeeDetails();
        },
        error: () => this.snackBar.open('Failed to update payment', 'Close', { duration: 3000 }),
      });
    } else {
      const payload = {
        ...this.paymentForm,
        studentId: this.selectedStudentId,
        classId: this.selectedClassId,
        academicYearId: this.selectedAcademicYearId,
      };
      this.api.createFeePayment(payload).subscribe({
        next: () => {
          this.snackBar.open('Payment recorded', 'Close', { duration: 3000 });
          this.closePaymentForm();
          this.loadFeeDetails();
        },
        error: () => this.snackBar.open('Failed to record payment', 'Close', { duration: 3000 }),
      });
    }
  }

  // ── Delete ──────────────────────────────────────────────────

  confirmDeletePayment(payment: any): void {
    this.selectedPayment = payment;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedPayment = null;
  }

  deletePayment(): void {
    if (!this.selectedPayment) return;
    const id = this.selectedPayment.paymentId;
    this.deleteDialogOpen = false;
    this.selectedPayment = null;

    this.api.deleteFeePayment(id).subscribe({
      next: () => {
        this.snackBar.open('Payment deleted', 'Close', { duration: 3000 });
        this.loadFeeDetails();
      },
      error: () => this.snackBar.open('Failed to delete payment', 'Close', { duration: 3000 }),
    });
  }
}
