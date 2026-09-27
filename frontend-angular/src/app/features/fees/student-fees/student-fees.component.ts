import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, Subject as RxSubject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { sortClassesByName } from '../../../shared/utils/class-sort';
import { ApiService } from '../../../core/services/api.service';
import { AdjustFeeDialogComponent } from '../adjust-fee/adjust-fee-dialog.component';
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
    MatProgressSpinnerModule, MatProgressBarModule, MatSlideToggleModule, MatAutocompleteModule, MatTooltipModule, MatSnackBarModule, MatDialogModule, PageHeaderComponent,
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

  /** Status dropdown filter. Empty string = "All Statuses". Values
   *  mirror the {@link StudentFeeLedger.Status} enum so the filter
   *  reads against the same field rowStatus() displays. */
  statusFilter: '' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' = '';
  readonly statusFilterOptions: Array<{ value: '' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'; label: string }> = [
    { value: '',        label: 'All Statuses' },
    { value: 'UNPAID',  label: 'Unpaid' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'PAID',    label: 'Paid' },
    { value: 'OVERDUE', label: 'Overdue' },
  ];

  // Roster ledger map for quick balance/status display in the roster table.
  rosterLedgersByStudentId: Record<string, StudentFeeLedger> = {};

  /** Student IDs currently mid-flight on the "Notify Fee Due" call.
   *  Used to disable the bell + show a spinner so the admin can't
   *  fire the same reminder twice in rapid succession. */
  notifyingStudentIds = new Set<string>();
  /** Roster rows mid-hostel-toggle — used to disable the switch while
   *  the PATCH is in flight so a double-click can't fire the endpoint
   *  twice for the same student. */
  togglingHostelStudentIds = new Set<string>();

  // ── Global student typeahead ─────────────────────────────────────
  /** Free-text driving the year-wide student autocomplete above the
   *  section-scoped roster. Independent of {@link studentSearch}
   *  (which is a client-side filter on the currently loaded roster). */
  globalStudentQuery = '';
  /** Debounced pipeline for the year-wide student lookup — 250 ms
   *  after the admin stops typing we hit /students?search=... so
   *  fast typers don't drown the backend. */
  private globalStudentQuery$ = new RxSubject<string>();
  /** Results shown in the mat-autocomplete panel. Capped at 15 in
   *  the request so a common name doesn't blow out the dropdown. */
  globalStudentResults: Student[] = [];
  isSearchingGlobal = false;

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

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((y: any) => y.current);
      if (current) {
        this.selectedAcademicYearId = current.academicYearId;
        this.loadClasses();
      }
    });

    // Wire the year-wide student typeahead. Debounce keeps a fast
    // typer from firing one request per keystroke; distinct is
    // intentionally OMITTED — clearing the input via the X button
    // and typing the same query again must re-fetch (with distinct,
    // the second identical query was silently blocked).
    this.globalStudentQuery$
      .pipe(
        debounceTime(250),
        switchMap((q) => {
          const trimmed = (q || '').trim();
          if (!trimmed || trimmed.length < 2 || !this.selectedAcademicYearId) {
            this.isSearchingGlobal = false;
            // Emit an empty result via `of` so the subscribe pipeline
            // still fires and clears any stale suggestion list.
            return of({ data: { content: [] as Student[] } } as any);
          }
          this.isSearchingGlobal = true;
          return this.api.getStudents(0, 15, {
            academicYearId: this.selectedAcademicYearId,
            search: trimmed,
          });
        }),
      )
      .subscribe({
        next: (res: any) => {
          this.globalStudentResults = res?.data?.content || [];
          this.isSearchingGlobal = false;
        },
        error: () => {
          this.globalStudentResults = [];
          this.isSearchingGlobal = false;
        },
      });
  }

  /** Fed by (ngModelChange) on the search input — pushes into the
   *  debounced pipeline. Short-circuits the clear case so the X button
   *  wipes suggestions instantly instead of waiting 250 ms. */
  onGlobalStudentQueryChange(value: string): void {
    this.globalStudentQuery = value || '';
    if (!this.globalStudentQuery.trim()) {
      // Cancel any in-flight state immediately on clear so the panel
      // never keeps a stale "No students found" message glued to it.
      this.globalStudentResults = [];
      this.isSearchingGlobal = false;
    }
    this.globalStudentQuery$.next(this.globalStudentQuery);
  }

  /** Optional autocomplete displayWith — hides the raw student object
   *  after selection and blanks the field so the user can search again. */
  displayGlobalStudent = (_s: any): string => '';

  /** "1st — A" style label for a student, resolved against the loaded
   *  classes list. Falls back to raw ids when the class list hasn't
   *  loaded yet (rare — classes load on AY pick, before any search). */
  classSectionLabel(student: Student): string {
    if (!student?.classId) return '';
    const cls = this.classes.find(c => c.classId === student.classId);
    if (!cls) return '';
    const secName = student.sectionId
      ? cls.sections?.find(s => s.sectionId === student.sectionId)?.name
      : null;
    return secName ? `${cls.name} — ${secName}` : cls.name;
  }

  /** Autocomplete selection handler — jump directly to that student's
   *  ledger by setting class + section + selectedStudentId and firing
   *  the same load path the roster row uses. Class sync fills sections;
   *  section sync loads the roster + ledgers; then we pick the student. */
  onGlobalStudentSelected(student: Student): void {
    if (!student?.studentId) return;
    // Clear the visible input; the ledger opens below.
    this.globalStudentQuery = '';
    this.globalStudentResults = [];

    const wantClass = student.classId;
    const wantSection = student.sectionId;
    if (!wantClass || !wantSection) {
      this.snackBar.open('This student has no class/section set — open their profile to fix.',
        'Close', { duration: 4000 });
      return;
    }
    // Class sync — sections come from cls.sections (already in
    // this.classes), so no extra fetch needed.
    if (this.selectedClassId !== wantClass) {
      this.selectedClassId = wantClass;
      this.onClassChange();
    }
    // onClassChange auto-picks the first section — override it with
    // the student's actual section.
    if (this.selectedSectionId !== wantSection) {
      this.selectedSectionId = wantSection;
      this.onSectionChange();
    }
    // Roster loads async; pick the student now — selectStudentRow
    // handles the ledger fetch, and the roster panel below just
    // shows this student's row highlighted once it lands.
    this.selectStudentRow(student);
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
    // Fetch the fee structure(s) for this class so we know whether the
    // hostel toggle should be interactive on the roster rows.
    this.refreshCurrentClassHostelConfig();
    // Auto-pick the first section so the admin lands on the roster
    // straight away — matches the load-time auto-pick behaviour and
    // spares them a click on every class change too.
    if (this.sections.length > 0) {
      this.selectedSectionId = this.sections[0].sectionId;
      this.onSectionChange();
    }
  }

  /** Snapshot of the currently-picked class's hostel config, used to
   *  gate the roster row toggle. Null when nothing's picked; enabled=false
   *  when the class exists but has no hostel structure. */
  currentClassHostel: {
    enabled: boolean;
    genderSplit: boolean;
    amount: number;
    boysAmount: number;
    girlsAmount: number;
  } | null = null;

  private refreshCurrentClassHostelConfig(): void {
    this.currentClassHostel = null;
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    this.api.getFeeStructures(this.selectedAcademicYearId, this.selectedClassId).subscribe({
      next: (res) => {
        const list = res.data || [];
        // Aggregate across all structure rows for this class — most
        // schools have one, but if a school splits (say "Tuition"
        // + "Exam Fee") we still consider hostel enabled if ANY row
        // has it on. Amount fields sum across rows too (rare).
        let enabled = false, split = false;
        let amount = 0, boys = 0, girls = 0;
        for (const s of list) {
          if (!s.hostelEnabled) continue;
          enabled = true;
          if (s.hostelGenderSplit) split = true;
          amount += (s.hostelAmount || 0);
          boys += (s.hostelBoysAmount || 0);
          girls += (s.hostelGirlsAmount || 0);
        }
        this.currentClassHostel = {
          enabled, genderSplit: split,
          amount, boysAmount: boys, girlsAmount: girls,
        };
      },
      error: () => { this.currentClassHostel = null; },
    });
  }

  /** True when the currently-selected class has hostel configured on
   *  its Fee Structure. Drives whether the roster row hostel toggle
   *  is interactive. */
  get classHasHostelConfigured(): boolean {
    return !!this.currentClassHostel?.enabled;
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

  /** Client-side narrowing of the roster — combines free-text search
   *  and the status dropdown. Both filters AND together. */
  get filteredStudents(): Student[] {
    const q = (this.studentSearch || '').trim().toLowerCase();
    const sf = this.statusFilter;
    let list = this.students;
    if (sf) {
      list = list.filter((s) => this.rowStatus(s) === sf);
    }
    if (q) {
      list = list.filter((s) => {
        const name = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
        const adm = (s.admissionNumber || '').toLowerCase();
        const roll = (s.rollNumber || '').toLowerCase();
        return name.includes(q) || adm.includes(q) || roll.includes(q);
      });
    }
    return list;
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
      // Sort the same way the Classes list does so "1st" lands before
      // "10th" and the auto-selected first class is the lowest grade,
      // not a lexicographic accident.
      this.classes = sortClassesByName(res.data || []);
      // Auto-pick the first class — onClassChange will chain into the
      // section auto-pick, so the admin lands on the roster instead
      // of empty dropdowns. Skip when nothing to pick.
      if (!this.selectedClassId && this.classes.length > 0) {
        this.selectedClassId = this.classes[0].classId;
        this.onClassChange();
      }
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

  /** Outstanding amount for the roster's bell button. Mirrors
   *  {@link rowBalance} — both read from the same ledger snapshot. */
  rowOutstanding(student: Student): number {
    return this.rowBalance(student);
  }

  /**
   * Click handler on the bell button — fires the in-app fee-due
   * reminder for one student. Disabled by template binding when:
   *   - outstanding is 0 (nothing to remind about)
   *   - request is already in flight for this student
   *
   * <p>Stops propagation on the click so the row's open-ledger
   * handler doesn't also fire. Snackbar reports recipient count on
   * success; a "no logins" response (recipients = 0) flags the case
   * where the student + parents don't have accounts yet, which is
   * actionable for the admin (create logins from Manage Users).</p>
   */
  notifyFeeDue(student: Student): void {
    if (!student?.studentId) return;
    const outstanding = this.rowOutstanding(student);
    if (outstanding <= 0) return;
    if (this.notifyingStudentIds.has(student.studentId)) return;
    if (!this.selectedAcademicYearId) {
      this.snackBar.open('Pick an academic year first.', 'Close', { duration: 3000 });
      return;
    }

    this.notifyingStudentIds.add(student.studentId);
    this.api.notifyFeeDue({
      studentId: student.studentId,
      academicYearId: this.selectedAcademicYearId,
      outstandingAmount: outstanding,
    }).subscribe({
      next: (res) => {
        this.notifyingStudentIds.delete(student.studentId);
        const recipients = res?.data ?? 0;
        if (recipients > 0) {
          this.snackBar.open(
            `Reminder sent to ${recipients} recipient${recipients === 1 ? '' : 's'}.`,
            'Close', { duration: 3500 });
        } else {
          this.snackBar.open(
            'No login accounts found for this student. Create logins from Manage Users.',
            'Close', { duration: 5000 });
        }
      },
      error: (err) => {
        this.notifyingStudentIds.delete(student.studentId);
        this.snackBar.open(
          err?.error?.message || 'Failed to send reminder.',
          'Close', { duration: 3500 });
      },
    });
  }

  /** True when THIS student is currently marked as a hostel resident.
   *  Read prefers the fresh ledger snapshot flag (patched after a
   *  toggle) and falls back to Student.hostelEnrolled for rows the
   *  ledger hasn't materialised yet. */
  isHostelEnrolled(student: Student): boolean {
    const l = this.rosterLedgersByStudentId[student.studentId];
    if (l && (l.hostelFee || 0) > 0) return true;
    return !!student.hostelEnrolled;
  }

  /** Class-level hostel amount for the currently selected class — read
   *  off any ledger already loaded (they all share the same class). Used
   *  to warn the admin what will get added before they confirm. */
  currentClassHostelAmount(): number {
    for (const key of Object.keys(this.rosterLedgersByStudentId)) {
      const l = this.rosterLedgersByStudentId[key];
      if ((l.hostelFee || 0) > 0) return l.hostelFee || 0;
    }
    return 0;
  }

  /** Flip hostel enrollment for a student inline from the roster row.
   *  Confirms before switching OFF a student who already has payments
   *  against the hostel line — turning it off drops totalDue, which
   *  can leave a credit balance the clerk needs to be aware of. */
  toggleHostel(student: Student, next: boolean, event?: Event): void {
    if (event) event.stopPropagation();
    if (!student?.studentId || !this.selectedAcademicYearId) return;
    if (this.togglingHostelStudentIds.has(student.studentId)) return;

    if (!next) {
      const l = this.rosterLedgersByStudentId[student.studentId];
      const paid = l?.totalPaid || 0;
      if (paid > 0) {
        const ok = window.confirm(
          `${this.getStudentName(student)} has already paid Rs. ${paid.toLocaleString()}. ` +
          `Removing hostel will lower the total due — the extra amount will show as a credit. Continue?`);
        if (!ok) return;
      }
    }

    this.togglingHostelStudentIds.add(student.studentId);
    this.api.setStudentHostelEnrollment({
      studentId: student.studentId,
      academicYearId: this.selectedAcademicYearId,
      hostelEnrolled: next,
    }).subscribe({
      next: (res) => {
        this.togglingHostelStudentIds.delete(student.studentId);
        const fresh = res.data;
        if (fresh) {
          this.rosterLedgersByStudentId = {
            ...this.rosterLedgersByStudentId,
            [student.studentId]: fresh,
          };
          // Patch the source Student row too so the toggle sticks
          // even if the ledger later falls out of the map (e.g. AY change).
          student.hostelEnrolled = next;
        }
        const added = fresh?.hostelFee || 0;
        this.snackBar.open(
          next
            ? `${this.getStudentName(student)} marked as hostel resident (Rs. ${added.toLocaleString()} added).`
            : `Hostel removed for ${this.getStudentName(student)}.`,
          'Close', { duration: 3500 });
      },
      error: (err) => {
        this.togglingHostelStudentIds.delete(student.studentId);
        this.snackBar.open(
          err?.error?.message || 'Failed to update hostel status.',
          'Close', { duration: 3500 });
      },
    });
  }

  /**
   * Opens the "Adjust Fee" dialog for a student — sets a per-student
   * surcharge (extra on top of class default) and/or a concession
   * (discount). Requires the roster's ledger snapshot to be loaded so
   * we know the current totalFee / adjustments. If the ledger hasn't
   * been created yet (student never had a payment attempt), we hit
   * getFeeLedgerForStudent first — the backend materialises one on read.
   *
   * Row click is stop-propagated so this doesn't also open the ledger
   * detail view underneath the dialog.
   */
  openAdjustFee(student: Student, event?: Event): void {
    if (event) event.stopPropagation();
    if (!student?.studentId || !this.selectedAcademicYearId) return;

    const cached = this.rosterLedgersByStudentId[student.studentId];
    if (cached) {
      this.launchAdjustDialog(cached);
      return;
    }
    // Materialise on demand — same call the "open ledger" flow uses.
    this.api.getFeeLedgerForStudent(student.studentId, this.selectedAcademicYearId).subscribe({
      next: (res) => {
        if (!res?.data) {
          this.snackBar.open('No fee ledger found for this student.', 'Close', { duration: 3000 });
          return;
        }
        this.rosterLedgersByStudentId = {
          ...this.rosterLedgersByStudentId,
          [student.studentId]: res.data,
        };
        this.launchAdjustDialog(res.data);
      },
      error: (e) => this.snackBar.open(e?.error?.message || 'Failed to load ledger', 'Close', { duration: 3000 }),
    });
  }

  /** Shared launcher — used by roster-row button and by the ledger
   *  view's own "Adjust" button. On save, refresh both the ledger
   *  detail (if we're viewing it) and the roster balance map. */
  private launchAdjustDialog(ledger: StudentFeeLedger): void {
    const ref = this.dialog.open(AdjustFeeDialogComponent, {
      data: { ledger },
      width: '520px',
      autoFocus: false,
      restoreFocus: true,
      disableClose: false,
    });
    ref.afterClosed().subscribe((updated: StudentFeeLedger | null) => {
      if (!updated) return;
      // Sync the roster map — balance/status chip refreshes instantly.
      if (updated.studentId) {
        this.rosterLedgersByStudentId = {
          ...this.rosterLedgersByStudentId,
          [updated.studentId]: updated,
        };
      }
      // Sync the open ledger view if it's the same one.
      if (this.ledger && this.ledger.ledgerId === updated.ledgerId) {
        this.ledger = updated;
      }
    });
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

  /** Open the printable receipt in a MatDialog on the same page.
   *  We pass the ledger + payment as dialog data so the receipt
   *  renders instantly without an extra fetch. Print and Download PDF
   *  actions live inside the dialog toolbar. */
  openReceipt(payment: FeeLedgerPayment): void {
    if (!payment?.paymentId || !this.ledger) return;
    import('../receipt/fee-receipt.component').then(m => {
      this.dialog.open(m.FeeReceiptComponent, {
        data: { ledger: this.ledger, payment },
        panelClass: 'fee-receipt-dialog-panel',
        width: 'auto',
        maxWidth: '95vw',
        autoFocus: false,
      });
    });
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
