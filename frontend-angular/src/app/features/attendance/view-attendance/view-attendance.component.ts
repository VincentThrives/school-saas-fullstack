import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AcademicYear } from '../../../core/models';

interface AbsentStudentRef {
  studentId: string;
  fullName: string;
  rollNumber?: string;
}

interface DayStatusRow {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  studentCount: number;
  status: 'MARKED' | 'NOT_MARKED';
  markedAt?: string;
  presentCount: number;
  absentCount: number;
  otherCount: number;
  /** Names of students marked ABSENT — empty when status is NOT_MARKED
   *  or when nobody was absent. Drives the under-counts line on the
   *  Marked card so admins see who's missing at a glance. */
  absentees?: AbsentStudentRef[];
}

/**
 * Day-wise attendance hub. The side nav drops the admin here so they
 * can see, at a glance, which (class, section) pairs still need
 * roll-call today and which are already done. Each card click opens
 * the per-class mark form prefilled with the right (class, section,
 * date) so they never touch the dropdown trio.
 */
@Component({
  selector: 'app-view-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './view-attendance.component.html',
  styleUrl: './view-attendance.component.scss',
  providers: [provideNativeDateAdapter()],
})
export class ViewAttendanceComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  selectedDate: Date = new Date();
  today: Date = new Date();

  rows: DayStatusRow[] = [];
  isLoading = false;

  /** Filter the card grid by class name. 'ALL' shows every class. */
  classFilter: string = 'ALL';

  /** Card keys ({classId}::{sectionId}) whose absentee list is expanded.
   *  Cards with the list collapsed show only the count header — keeps the
   *  grid tidy when a section has 15+ absentees. */
  private expandedAbsentees = new Set<string>();

  /** Above this absentee count we fold the list behind a toggle; at or
   *  below, the chips render inline. 4 keeps the card height bounded
   *  while still giving small-absentee sections a glanceable list. */
  readonly absenteeAccordionThreshold = 4;

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = Array.isArray(res.data) ? res.data : (res.data as any)?.content || [];
        const current = this.academicYears.find((y) => y.current);
        this.selectedAcademicYearId = current ? current.academicYearId : (this.academicYears[0]?.academicYearId || '');
        this.reload();
      },
      error: () => {
        this.academicYears = [];
      },
    });
  }

  onAcademicYearChange(): void { this.reload(); }
  onDateChange(): void { this.reload(); }

  reload(): void {
    if (!this.selectedAcademicYearId || !this.selectedDate) {
      this.rows = [];
      return;
    }
    this.isLoading = true;
    const dateStr = this.formatDate(this.selectedDate);
    this.api.getAttendanceDayStatus(this.selectedAcademicYearId, dateStr).subscribe({
      next: (res) => {
        this.rows = Array.isArray(res.data) ? res.data : [];
        this.isLoading = false;
      },
      error: (err) => {
        this.rows = [];
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to load attendance status', 'Close', { duration: 3000 });
      },
    });
  }

  /** Distinct class names in the result — drives the class-filter chips. */
  get classNameOptions(): string[] {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.className) set.add(r.className);
    }
    return Array.from(set);
  }

  get filteredRows(): DayStatusRow[] {
    if (this.classFilter === 'ALL') return this.rows;
    return this.rows.filter(r => r.className === this.classFilter);
  }

  get todoRows(): DayStatusRow[] {
    return this.filteredRows.filter(r => r.status === 'NOT_MARKED');
  }

  get doneRows(): DayStatusRow[] {
    return this.filteredRows.filter(r => r.status === 'MARKED');
  }

  openMarkAttendance(row: DayStatusRow): void {
    // Drop into the existing detail form with everything pre-selected so
    // the admin lands on the student grid in one click — no dropdown
    // round-trip. Date is forwarded as a query param so backdated sessions
    // also wire through.
    const dateStr = this.formatDate(this.selectedDate);
    this.router.navigate(
      ['/attendance/mark'],
      { queryParams: { classId: row.classId, sectionId: row.sectionId, date: dateStr } }
    );
  }

  /** Compact "Roll - Name" labels for absentees on the Marked card.
   *  Falls back to bare name when no roll number is set. */
  absenteeLabel(a: AbsentStudentRef): string {
    if (a.rollNumber) return `${a.rollNumber} · ${a.fullName}`;
    return a.fullName;
  }

  /** True when this card has enough absentees that the list folds
   *  behind a toggle. Below the threshold the chips render inline. */
  shouldCollapseAbsentees(row: DayStatusRow): boolean {
    return (row.absentees?.length || 0) > this.absenteeAccordionThreshold;
  }

  /** True when the admin has expanded this card's absentee list. */
  isAbsenteeListExpanded(row: DayStatusRow): boolean {
    return this.expandedAbsentees.has(this.absenteeKey(row));
  }

  /** Toggle the absentee list open/closed on a card. Stops the event
   *  propagating up so the card's own click handler (open Mark
   *  Attendance form) doesn't fire from the same gesture. */
  toggleAbsenteeList(row: DayStatusRow, event: Event): void {
    event.stopPropagation();
    const key = this.absenteeKey(row);
    if (this.expandedAbsentees.has(key)) this.expandedAbsentees.delete(key);
    else this.expandedAbsentees.add(key);
  }

  private absenteeKey(row: DayStatusRow): string {
    return `${row.classId}::${row.sectionId}`;
  }

  /** Friendly "9:12 AM" timestamp for the marked-at tooltip on Done cards. */
  formatMarkedTime(iso: string | undefined): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
