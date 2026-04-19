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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import {
  SchoolClass,
  AcademicYear,
  Student,
  StudentFeeLedger,
  FeeLedgerPayment,
  LedgerPaymentMode,
  AppendPaymentRequest,
  UpdateLedgerPaymentRequest,
} from '../../../core/models';

@Component({
  selector: 'app-student-fees',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatProgressBarModule, MatTooltipModule, MatSnackBarModule, PageHeaderComponent,
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

  // Roster ledger map for quick balance/status display in the roster table.
  rosterLedgersByStudentId: Record<string, StudentFeeLedger> = {};

  // Currently-open student's ledger
  ledger: StudentFeeLedger | null = null;
  isLoading = false;
  displayedColumns = ['paymentDate', 'receiptNumber', 'amount', 'mode', 'collectedBy', 'notes', 'actions'];

  // Payment form
  paymentFormOpen = false;
  editingPaymentId: string | null = null;
  paymentForm = {
    amount: 0,
    mode: 'CASH' as LedgerPaymentMode,
    paidAt: '',
    notes: '',
    reason: '',
  };

  // Void dialog
  voidDialogOpen = false;
  voidTarget: FeeLedgerPayment | null = null;
  voidReason = '';

  // Overpayment warning dialog
  overpaymentDialogOpen = false;
  overpaymentAttempted = 0;
  overpaymentAllowed = 0;

  paymentModes: LedgerPaymentMode[] = ['CASH', 'ONLINE', 'UPI', 'CHEQUE', 'DD', 'CARD', 'OTHER'];

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
    this.rosterLedgersByStudentId = {};
    this.ledger = null;
    this.studentSearch = '';
    this.loadClasses();
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.students = [];
    this.rosterLedgersByStudentId = {};
    this.ledger = null;
    this.studentSearch = '';
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = cls?.sections || [];
  }

  onSectionChange(): void {
    this.selectedStudentId = '';
    this.ledger = null;
    this.studentSearch = '';
    if (this.selectedClassId && this.selectedSectionId) {
      this.loadStudents();
      this.loadRosterLedgers();
    } else {
      this.students = [];
      this.rosterLedgersByStudentId = {};
    }
  }

  /** Client-side search narrowing of the roster. */
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

  /** Click a roster row to open that student's ledger. */
  selectStudentRow(student: Student): void {
    if (!student?.studentId) return;
    this.selectedStudentId = student.studentId;
    if (this.selectedAcademicYearId) {
      this.loadLedger();
    }
  }

  clearStudent(): void {
    this.selectedStudentId = '';
    this.ledger = null;
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
      error: () => { this.students = []; this.isLoadingStudents = false; },
    });
  }

  /**
   * Preload the ledger balance/status for every student in the roster so we
   * can render the status chip + outstanding amount without drilling in.
   */
  loadRosterLedgers(): void {
    this.rosterLedgersByStudentId = {};
    this.api.getFeeLedgers({
      academicYearId: this.selectedAcademicYearId,
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId,
    }).subscribe({
      next: (res) => {
        const map: Record<string, StudentFeeLedger> = {};
        (res.data || []).forEach(l => { if (l.studentId) map[l.studentId] = l; });
        this.rosterLedgersByStudentId = map;
      },
      error: () => { this.rosterLedgersByStudentId = {}; },
    });
  }

  loadLedger(): void {
    this.isLoading = true;
    this.api.getFeeLedgerForStudent(this.selectedStudentId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        this.ledger = res.data;
        this.isLoading = false;
        // Keep the roster map in sync for the summary row above.
        if (this.ledger && this.ledger.studentId) {
          this.rosterLedgersByStudentId = {
            ...this.rosterLedgersByStudentId,
            [this.ledger.studentId]: this.ledger,
          };
        }
      },
      error: () => { this.ledger = null; this.isLoading = false; },
    });
  }

  getStudentName(student: Student): string {
    return `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.admissionNumber;
  }

  /** Roster row helpers — read from the preloaded map. */
  rowBalance(student: Student): number {
    const l = this.rosterLedgersByStudentId[student.studentId];
    return l ? l.balance : 0;
  }
  rowStatus(student: Student): string {
    const l = this.rosterLedgersByStudentId[student.studentId];
    return l ? l.status : 'UNPAID';
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

  /** Visible payments (exclude superseded-by-correction entries for a tidy view). */
  get visiblePayments(): FeeLedgerPayment[] {
    if (!this.ledger) return [];
    const supersededIds = new Set<string>();
    this.ledger.payments.forEach(p => {
      if (p.supersededPaymentId) supersededIds.add(p.supersededPaymentId);
    });
    // Show everything including voided, but highlight voided rows in the UI.
    // Omit the superseded originals once a correction exists.
    return this.ledger.payments
      .filter(p => !supersededIds.has(p.paymentId))
      .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
  }

  progressColor(): 'primary' | 'accent' | 'warn' {
    const p = this.ledger ? this.progressPercent : 0;
    if (p >= 100) return 'primary';
    if (p >= 50) return 'accent';
    return 'warn';
  }

  get progressPercent(): number {
    if (!this.ledger || this.ledger.totalDue <= 0) return 0;
    return Math.min(100, Math.round((this.ledger.totalPaid / this.ledger.totalDue) * 100));
  }

  // ── Payment form ──────────────────────────────────────────

  openPaymentForm(payment?: FeeLedgerPayment): void {
    if (payment) {
      this.editingPaymentId = payment.paymentId;
      this.paymentForm = {
        amount: payment.amount,
        mode: payment.mode,
        paidAt: payment.paidAt,
        notes: payment.notes || '',
        reason: '',
      };
    } else {
      this.editingPaymentId = null;
      const today = new Date().toISOString().split('T')[0];
      this.paymentForm = { amount: 0, mode: 'CASH', paidAt: today, notes: '', reason: '' };
    }
    this.paymentFormOpen = true;
  }

  closePaymentForm(): void {
    this.paymentFormOpen = false;
    this.editingPaymentId = null;
  }

  savePayment(): void {
    if (!this.ledger) return;
    if (!this.paymentForm.amount || this.paymentForm.amount <= 0) {
      this.snackBar.open('Enter a positive amount', 'Close', { duration: 2500 });
      return;
    }

    // ─── Overpayment guard ──────────────────────────────────────
    // New payment: can't exceed current balance.
    // Correction:  projected total (current totalPaid - old amount + new amount) can't exceed totalDue.
    const totalDue = this.ledger.totalDue || 0;
    let allowed: number;
    if (this.editingPaymentId) {
      const existing = this.ledger.payments.find(p => p.paymentId === this.editingPaymentId);
      const existingAmount = existing ? existing.amount : 0;
      allowed = totalDue - (this.ledger.totalPaid - existingAmount);
    } else {
      allowed = this.ledger.balance;
    }
    if (this.paymentForm.amount > allowed + 0.0001) {
      this.overpaymentAttempted = this.paymentForm.amount;
      this.overpaymentAllowed = Math.max(0, allowed);
      this.overpaymentDialogOpen = true;
      return;
    }

    if (this.editingPaymentId) {
      const req: UpdateLedgerPaymentRequest = {
        amount: this.paymentForm.amount,
        mode: this.paymentForm.mode,
        paidAt: this.paymentForm.paidAt || undefined,
        notes: this.paymentForm.notes || undefined,
        reason: this.paymentForm.reason || undefined,
      };
      this.api.updateFeeLedgerPayment(this.ledger.ledgerId, this.editingPaymentId, req).subscribe({
        next: (res) => {
          this.snackBar.open('Payment corrected', 'Close', { duration: 2500 });
          this.ledger = res.data;
          this.closePaymentForm();
        },
        error: (e) => this.snackBar.open(e?.error?.message || 'Failed to update payment', 'Close', { duration: 3000 }),
      });
    } else {
      const req: AppendPaymentRequest = {
        amount: this.paymentForm.amount,
        mode: this.paymentForm.mode,
        paidAt: this.paymentForm.paidAt || undefined,
        notes: this.paymentForm.notes || undefined,
      };
      this.api.appendFeePayment(this.ledger.ledgerId, req).subscribe({
        next: (res) => {
          this.snackBar.open('Payment recorded', 'Close', { duration: 2500 });
          this.ledger = res.data;
          if (this.ledger && this.ledger.studentId) {
            this.rosterLedgersByStudentId = {
              ...this.rosterLedgersByStudentId,
              [this.ledger.studentId]: this.ledger,
            };
          }
          this.closePaymentForm();
        },
        error: (e) => this.snackBar.open(e?.error?.message || 'Failed to record payment', 'Close', { duration: 3000 }),
      });
    }
  }

  // ── Void ──────────────────────────────────────────────────

  openVoidDialog(payment: FeeLedgerPayment): void {
    this.voidTarget = payment;
    this.voidReason = '';
    this.voidDialogOpen = true;
  }

  closeVoidDialog(): void {
    this.voidDialogOpen = false;
    this.voidTarget = null;
    this.voidReason = '';
  }

  // ── Overpayment dialog ────────────────────────────────────────

  closeOverpaymentDialog(): void {
    this.overpaymentDialogOpen = false;
  }

  /** Snap the input to the max allowed and close the warning so the user can save. */
  setToAllowedAmount(): void {
    this.paymentForm.amount = this.overpaymentAllowed;
    this.overpaymentDialogOpen = false;
  }

  confirmVoid(): void {
    if (!this.ledger || !this.voidTarget) return;
    const ledgerId = this.ledger.ledgerId;
    const paymentId = this.voidTarget.paymentId;
    this.api.voidFeeLedgerPayment(ledgerId, paymentId, { reason: this.voidReason || undefined }).subscribe({
      next: (res) => {
        this.snackBar.open('Payment voided', 'Close', { duration: 2500 });
        this.ledger = res.data;
        if (this.ledger && this.ledger.studentId) {
          this.rosterLedgersByStudentId = {
            ...this.rosterLedgersByStudentId,
            [this.ledger.studentId]: this.ledger,
          };
        }
        this.closeVoidDialog();
      },
      error: (e) => this.snackBar.open(e?.error?.message || 'Failed to void payment', 'Close', { duration: 3000 }),
    });
  }
}
