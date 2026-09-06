import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { EmployeeDayReportDialogComponent, EmployeeDayReportData } from './employee-day-report-dialog/employee-day-report-dialog.component';
import { forkJoin } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../../../../core/services/api.service';
import { HrDailyAttendance, HrEmployeeOption, HrAttendanceReport } from '../../../../core/models';

/**
 * HR Attendance Report page.
 *
 * <p>Two views over the same fetched range:</p>
 * <ul>
 *   <li><b>Summary</b> — one row per employee for the range with
 *       Present / Late / Half-day / Absent counts and attendance %.
 *       Sortable, searchable, primary lens for "who's slacking".</li>
 *   <li><b>Detailed grid</b> — employees × dates matrix, each cell
 *       a colour-coded chip (P/L/H/A). Best for spotting patterns
 *       (Fridays off, first-week absences, etc).</li>
 * </ul>
 *
 * <p>Filters: date range (with presets), designation, status,
 * free-text employee search. Export to CSV / print-to-PDF via
 * the browser — no third-party libs needed for the MVP.</p>
 */
type StatusKey = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';

interface EmployeeSummary {
  employeeId: string;
  name: string;
  designation?: string;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  /** Days in the picked range where NO attendance row exists at all
   *  (neither punched, marked, nor absent-stamped by the daily job).
   *  Rendered as its own column so HR can tell the difference between
   *  "marked absent" and "never showed up on the system". */
  unmarked: number;
  /** Total calendar days in the picked range (raw). */
  totalDays: number;
  /** Working days for this employee = totalDays − Sundays − holidays,
   *  plus any Sunday / holiday they actually worked on (attendance row
   *  exists). This is the honest denominator for the % — a school
   *  where Saturdays are working days shouldn't be scored against a
   *  fixed weekend expectation. */
  workingDays: number;
  /** (present + late + halfDay*0.5) / workingDays * 100 — an employee
   *  who missed most of the range can't score 100% just because their
   *  one recorded day was Present. */
  percent: number;
}

/** Per-cell status in the detailed grid — either the status letter
 *  or empty (no row for that day). */
interface GridCell {
  status?: StatusKey;
  late?: boolean;
  inTime?: string;
  outTime?: string;
}

interface GridRow {
  employeeId: string;
  name: string;
  designation?: string;
  cells: Map<string, GridCell>;   // key = yyyy-MM-dd
}

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule,
    MatButtonToggleModule, MatTableModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule,
    MatDialogModule,
    PageHeaderComponent,
  ],
  providers: [DatePipe],
  templateUrl: './attendance-report.component.html',
  styleUrl: './attendance-report.component.scss',
})
export class AttendanceReportComponent implements OnInit {

  // ── Filters ──────────────────────────────────────
  fromDate: Date = this.startOfMonth(new Date());
  toDate: Date = new Date();
  todayCap: Date = new Date();

  designationFilter: string = 'ALL';    // 'ALL' | 'TEACHER' | ...
  statusFilter: 'ALL' | StatusKey = 'ALL';
  searchQuery = '';

  view: 'summary' | 'detailed' = 'summary';

  // ── Data ─────────────────────────────────────────
  isLoading = false;
  rows: HrDailyAttendance[] = [];
  /** Full employee roster — needed so employees who never marked
   *  in the range still show up in the summary with an Unmarked =
   *  totalDays count. Loaded once alongside the report data. */
  employees: HrEmployeeOption[] = [];
  /** Declared holidays that fall in the range — one entry per day
   *  (multi-day holidays already expanded server-side). Used to
   *  exclude those days from the working-days denominator and to
   *  render Holiday chips in the day-by-day dialog. */
  holidayDates = new Set<string>();
  /** Holiday date → name lookup for tooltips. */
  holidayNameByDate = new Map<string, string>();

  /** Distinct designations found in the fetched data — powers the
   *  designation filter dropdown so it's always in sync with what's
   *  actually in the range. */
  availableDesignations: string[] = [];

  /** yyyy-MM-dd strings for every day in the current range —
   *  drives the detailed grid's column headers. */
  dateColumns: string[] = [];

  // ── Formatters ───────────────────────────────────

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  /** Opens the per-employee day-by-day dialog for one summary row.
   *  Filters the fetched rows to just this employee and hands the
   *  dialog the current date range so it can render Unmarked /
   *  Week-off entries for days without a row. Dialog has its own
   *  Excel button that downloads just this employee's CSV. */
  openEmployeeDetail(employeeId: string, name: string, designation?: string): void {
    const rowsForEmp = this.rows.filter(r => r.employeeId === employeeId);
    const data: EmployeeDayReportData = {
      employeeId,
      employeeName: name,
      designation,
      fromDate: this.fromDate,
      toDate: this.toDate,
      dateColumns: [...this.dateColumns],
      rows: rowsForEmp,
      holidayDates: [...this.holidayDates],
      holidayNames: new Map(this.holidayNameByDate),
    };
    this.dialog.open(EmployeeDayReportDialogComponent, {
      data,
      autoFocus: false,
      panelClass: 'employee-day-report-panel',
      width: '100vw',
      maxWidth: '100vw',
    });
  }

  ngOnInit(): void {
    this.loadReport();
  }

  // ── Loading ──────────────────────────────────────

  loadReport(): void {
    if (!this.fromDate || !this.toDate) {
      this.snack.open('Pick a date range', 'Close', { duration: 2500 });
      return;
    }
    if (this.fromDate > this.toDate) {
      // Swap so a stale range from a previous fetch doesn't
      // silently 400 on the backend or return empty.
      [this.fromDate, this.toDate] = [this.toDate, this.fromDate];
    }
    this.isLoading = true;
    const from = this.toIsoDate(this.fromDate);
    const to   = this.toIsoDate(this.toDate);
    // Report + full roster in parallel — roster feeds the "employees
    // who never marked" rows in the summary and the Unmarked column.
    forkJoin({
      report: this.api.hrAttendanceReport(from, to),
      employees: this.api.hrListEmployees(),
    }).subscribe({
      next: (res) => {
        const reportData: HrAttendanceReport = (res.report?.data as any) || { rows: [], holidayDates: [], holidayNames: [] };
        this.rows = reportData.rows || [];
        this.employees = res.employees?.data || [];

        // Rebuild the holiday lookup structures — Set for O(1)
        // membership tests in workingDays calc, Map for tooltip
        // labels in the day-by-day dialog.
        this.holidayDates = new Set<string>(reportData.holidayDates || []);
        this.holidayNameByDate = new Map<string, string>();
        (reportData.holidayDates || []).forEach((d, i) => {
          this.holidayNameByDate.set(d, (reportData.holidayNames || [])[i] || '');
        });

        // Union of designations from both sources so the filter shows
        // options even when someone with that role hasn't marked yet.
        const desigs = new Set<string>();
        this.rows.forEach(r => r.designation && desigs.add(r.designation));
        this.employees.forEach(e => e.designation && desigs.add(e.designation));
        this.availableDesignations = Array.from(desigs).sort();
        this.rebuildDateColumns();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.snack.open(
          err?.error?.message || 'Failed to load attendance report',
          'Close', { duration: 4000 });
      },
    });
  }

  // ── Preset date ranges ───────────────────────────

  applyPreset(preset: 'week' | 'month' | 'last30' | 'last7'): void {
    const now = new Date();
    switch (preset) {
      case 'week': {
        const d = new Date(now);
        const dow = d.getDay();     // 0 = Sunday
        const diff = dow;           // back to Sunday
        d.setDate(d.getDate() - diff);
        this.fromDate = d;
        this.toDate = now;
        break;
      }
      case 'month':
        this.fromDate = this.startOfMonth(now);
        this.toDate = now;
        break;
      case 'last30': {
        const d = new Date(now); d.setDate(d.getDate() - 29);
        this.fromDate = d; this.toDate = now;
        break;
      }
      case 'last7': {
        const d = new Date(now); d.setDate(d.getDate() - 6);
        this.fromDate = d; this.toDate = now;
        break;
      }
    }
    this.loadReport();
  }

  // ── Filtered dataset ─────────────────────────────

  /** Rows passing every active filter — used by BOTH the summary
   *  and detailed views so what the user sees stays consistent
   *  across the tab switch. */
  get filteredRows(): HrDailyAttendance[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.rows.filter(r => {
      if (this.designationFilter !== 'ALL' && r.designation !== this.designationFilter) return false;
      if (this.statusFilter !== 'ALL') {
        if (this.statusFilter === 'LATE' ? !r.late : r.status !== this.statusFilter) return false;
      }
      if (q && !(r.employeeName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // ── Summary aggregation ─────────────────────────

  get summaryRows(): EmployeeSummary[] {
    // Roster-first: seed one row per employee so people who never
    // marked in the range still appear.
    const totalDays = this.dateColumns.length;
    // Base working days = calendar days − Sundays − declared holidays.
    // This is the SAME for everyone until we credit off-day work
    // per-employee below.
    let baseWorkingDays = 0;
    const dateInfo = this.dateColumns.map(iso => {
      const dow = new Date(iso).getDay();
      const isSun = dow === 0;
      const isHoliday = this.holidayDates.has(iso);
      const isOff = isSun || isHoliday;
      if (!isOff) baseWorkingDays++;
      return { iso, isSun, isHoliday, isOff };
    });

    const rosterFilteredByDesig = this.employees.filter(e =>
      this.designationFilter === 'ALL' || e.designation === this.designationFilter,
    );

    const map = new Map<string, EmployeeSummary>();
    for (const emp of rosterFilteredByDesig) {
      map.set(emp.employeeId, {
        employeeId: emp.employeeId,
        name: emp.name || '(unnamed)',
        designation: emp.designation,
        present: 0, late: 0, halfDay: 0, absent: 0,
        unmarked: 0,      // computed below
        totalDays,        // raw calendar days
        workingDays: baseWorkingDays,   // may be bumped up if employee worked on Sunday / holiday
        percent: 0,
      });
    }

    // Track which off-days each employee actually worked, so we
    // can add those to their personal workingDays count. Key =
    // employeeId + '|' + dateIso; the Set prevents double-counting
    // if a row appears twice.
    const workedOnOff = new Map<string, Set<string>>();

    // Overlay the fetched rows.
    for (const r of this.rows) {
      const e = map.get(r.employeeId);
      if (!e) continue;
      if (!e.designation && r.designation) e.designation = r.designation;

      if (r.late) e.late++;
      else if (r.status === 'HALF_DAY') e.halfDay++;
      else if (r.status === 'ABSENT') e.absent++;
      else if (r.status === 'PRESENT') e.present++;

      // Award working-day credit when this row lands on a Sunday
      // or declared holiday — the employee came in on the off day
      // so it counts toward their expected work.
      const dow = new Date(r.date).getDay();
      const wasOffDay = (dow === 0) || this.holidayDates.has(r.date);
      // ABSENT on an off-day doesn't credit — they were expected
      // NOT to work; being absent is the default state.
      if (wasOffDay && r.status !== 'ABSENT') {
        let s = workedOnOff.get(r.employeeId);
        if (!s) { s = new Set(); workedOnOff.set(r.employeeId, s); }
        s.add(r.date);
      }
    }

    // Finalize per-employee derived fields.
    for (const e of map.values()) {
      const offWorked = workedOnOff.get(e.employeeId)?.size || 0;
      e.workingDays = baseWorkingDays + offWorked;
      // Unmarked = total − (marked ANY status). A P/L/H/A on a
      // Sunday counts as marked, so a person who came in on a
      // Sunday doesn't get penalised with an Unmarked entry too.
      const marked = e.present + e.late + e.halfDay + e.absent;
      e.unmarked = Math.max(0, e.totalDays - marked);
      // % anchored to WORKING days (not total). Half-days count
      // as 0.5; Late still counts as present (showed up, just tardy).
      const attendedEq = e.present + e.late + e.halfDay * 0.5;
      e.percent = e.workingDays > 0
        ? Math.round((attendedEq / e.workingDays) * 100)
        : 0;
    }

    // Post-aggregation filters — status + search work on the
    // computed row so a "Late" filter shows employees with ≥1 Late.
    const q = this.searchQuery.trim().toLowerCase();
    return Array.from(map.values())
      .filter(e => {
        if (q && !e.name.toLowerCase().includes(q)) return false;
        if (this.statusFilter === 'LATE'      && e.late    === 0) return false;
        if (this.statusFilter === 'HALF_DAY'  && e.halfDay === 0) return false;
        if (this.statusFilter === 'ABSENT'    && e.absent  === 0) return false;
        if (this.statusFilter === 'PRESENT'   && e.present === 0) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Overall KPIs across the summary. Anchored to the FULL roster
   *  and the FULL date range so a low-turnout day drags the average
   *  down instead of the earlier behaviour where the average was
   *  computed only over recorded rows. */
  get kpis(): {
    totalEmployees: number;
    totalDays: number;
    workingDays: number;
    holidayDays: number;
    avgAttendance: number;
    late: number; halfDay: number; absent: number; unmarked: number;
  } {
    const rows = this.summaryRows;
    let late = 0, halfDay = 0, absent = 0, present = 0, unmarked = 0;
    let workingSlots = 0, attendedEq = 0;
    for (const r of rows) {
      present  += r.present;
      late     += r.late;
      halfDay  += r.halfDay;
      absent   += r.absent;
      unmarked += r.unmarked;
      workingSlots += r.workingDays;
      attendedEq   += r.present + r.late + r.halfDay * 0.5;
    }
    // Same base-working-days calc as summaryRows but as a single
    // scalar for the KPI card ("22 working days this month").
    let baseWorking = 0;
    for (const iso of this.dateColumns) {
      const dow = new Date(iso).getDay();
      const isSun = dow === 0;
      const isHoliday = this.holidayDates.has(iso);
      if (!isSun && !isHoliday) baseWorking++;
    }
    return {
      totalEmployees: rows.length,
      totalDays: this.dateColumns.length,
      workingDays: baseWorking,
      holidayDays: [...this.holidayDates].filter(d =>
        d >= this.dateColumns[0] && d <= this.dateColumns[this.dateColumns.length - 1]).length,
      avgAttendance: workingSlots > 0 ? Math.round((attendedEq / workingSlots) * 100) : 0,
      late, halfDay, absent, unmarked,
    };
  }

  // ── Detailed grid ───────────────────────────────

  private rebuildDateColumns(): void {
    const cols: string[] = [];
    const d = new Date(this.fromDate);
    while (d <= this.toDate) {
      cols.push(this.toIsoDate(d));
      d.setDate(d.getDate() + 1);
    }
    this.dateColumns = cols;
  }

  get gridRows(): GridRow[] {
    // Roster-first so employees who never marked still get a row
    // (mirrors the summary tab). Otherwise a whole employee vanishes
    // from the grid the moment they miss a full range.
    const byEmp = new Map<string, GridRow>();
    const rosterFilteredByDesig = this.employees.filter(e =>
      this.designationFilter === 'ALL' || e.designation === this.designationFilter,
    );
    for (const emp of rosterFilteredByDesig) {
      byEmp.set(emp.employeeId, {
        employeeId: emp.employeeId,
        name: emp.name || '(unnamed)',
        designation: emp.designation,
        cells: new Map(),
      });
    }
    for (const r of this.rows) {
      const row = byEmp.get(r.employeeId);
      if (!row) continue;
      if (!row.designation && r.designation) row.designation = r.designation;
      row.cells.set(r.date, {
        status: r.status as StatusKey,
        late: r.late,
        inTime: r.inTime,
        outTime: r.outTime,
      });
    }
    return Array.from(byEmp.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** True when the date is a Sunday. */
  isSunday(iso: string): boolean {
    return new Date(iso).getDay() === 0;
  }

  /** True when the date is a declared holiday. */
  isHoliday(iso: string): boolean {
    return this.holidayDates.has(iso);
  }

  cellClass(cell?: GridCell, dateIso?: string): string {
    // Real punch always wins the fill — an employee who worked on a
    // Sunday / holiday should still show the P/L chip, not the off-day
    // tint. Off-day styling only applies to cells with no data.
    if (cell?.late)                    return 'grid-cell grid-cell--late';
    if (cell?.status === 'HALF_DAY')   return 'grid-cell grid-cell--halfday';
    if (cell?.status === 'ABSENT')     return 'grid-cell grid-cell--absent';
    if (cell?.status === 'PRESENT')    return 'grid-cell grid-cell--present';
    if (dateIso && this.isHoliday(dateIso)) return 'grid-cell grid-cell--holiday';
    if (dateIso && this.isSunday(dateIso))  return 'grid-cell grid-cell--weekoff';
    return 'grid-cell grid-cell--empty';
  }

  cellLabel(cell?: GridCell, dateIso?: string): string {
    if (cell?.late)                    return 'L';
    if (cell?.status === 'HALF_DAY')   return 'H';
    if (cell?.status === 'ABSENT')     return 'A';
    if (cell?.status === 'PRESENT')    return 'P';
    if (dateIso && this.isHoliday(dateIso)) return 'HO';
    if (dateIso && this.isSunday(dateIso))  return 'WO';
    // Em-dash reads clearly at the grid's small font size — the
    // earlier middle-dot (·) was almost invisible at 11px muted grey.
    return '—';
  }

  cellTooltip(cell?: GridCell, dateIso?: string): string {
    const parts: string[] = [dateIso || ''];
    if (cell?.late) parts.push('Late');
    else if (cell?.status) parts.push(cell.status);
    else if (dateIso && this.isHoliday(dateIso)) {
      const name = this.holidayNameByDate.get(dateIso) || '';
      parts.push(name ? `Holiday — ${name}` : 'Holiday');
    }
    else if (dateIso && this.isSunday(dateIso)) parts.push('Week-off (Sunday)');
    else parts.push('No punch');
    if (cell?.inTime)  parts.push(`IN ${this.formatIsoTime(cell.inTime)}`);
    if (cell?.outTime) parts.push(`OUT ${this.formatIsoTime(cell.outTime)}`);
    return parts.filter(Boolean).join(' · ');
  }

  formatIsoTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN',
      { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  designationLabel(d: string): string {
    return d
      .split('_')
      .map(w => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  // ── Exports ─────────────────────────────────────

  /** Excel-friendly CSV export of the CURRENT filtered summary view.
   *  Detailed grid export is CSV too — dates as columns. Using CSV
   *  instead of true .xlsx keeps the bundle lean and every desktop
   *  spreadsheet program opens it. */
  exportCsv(): void {
    if (this.view === 'summary') this.exportSummaryCsv();
    else this.exportDetailedCsv();
  }

  private exportSummaryCsv(): void {
    const rows = this.summaryRows;
    if (rows.length === 0) {
      this.snack.open('No data to export', 'Close', { duration: 2500 });
      return;
    }
    const header = ['Employee', 'Designation', 'Present', 'Late', 'Half-day', 'Absent', 'Unmarked', 'Working', 'Total', 'Attendance %'];
    const lines = [
      header.map(this.csvEscape).join(','),
      ...rows.map(r => [
        r.name, r.designation || '', r.present, r.late, r.halfDay, r.absent, r.unmarked,
        r.workingDays, r.totalDays, `${r.percent}%`,
      ].map(v => this.csvEscape(String(v))).join(',')),
    ];
    this.download(`attendance-summary_${this.toIsoDate(this.fromDate)}_to_${this.toIsoDate(this.toDate)}.csv`,
      lines.join('\r\n'));
  }

  private exportDetailedCsv(): void {
    const rows = this.gridRows;
    if (rows.length === 0) {
      this.snack.open('No data to export', 'Close', { duration: 2500 });
      return;
    }
    const header = ['Employee', 'Designation', ...this.dateColumns];
    const lines = [
      header.map(this.csvEscape).join(','),
      ...rows.map(r => {
        const cells = this.dateColumns.map(d => this.cellLabel(r.cells.get(d), d));
        return [r.name, r.designation || '', ...cells]
          .map(v => this.csvEscape(String(v))).join(',');
      }),
    ];
    this.download(`attendance-detailed_${this.toIsoDate(this.fromDate)}_to_${this.toIsoDate(this.toDate)}.csv`,
      lines.join('\r\n'));
  }

  /** Real PDF built programmatically with jsPDF + autoTable. The
   *  earlier window.print() version rendered the on-screen surface
   *  (sidebar + hover tooltips + filter chrome) which read as a
   *  screenshot rather than a report. Now we produce a proper A4
   *  document with a title block, KPI strip, and paged table. */
  exportPdf(): void {
    if (this.view === 'summary') this.exportSummaryPdf();
    else this.exportDetailedPdf();
  }

  private exportSummaryPdf(): void {
    const rows = this.summaryRows;
    if (rows.length === 0) {
      this.snack.open('No data to export', 'Close', { duration: 2500 });
      return;
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    this.drawPdfHeader(doc, 'Attendance Report — Summary');
    this.drawKpiStrip(doc);

    autoTable(doc, {
      startY: 168,
      head: [['Employee', 'Designation', 'Present', 'Late', 'Half-day', 'Absent', 'Unmarked', 'Working', 'Total', 'Attendance %']],
      body: rows.map(r => [
        r.name,
        r.designation ? this.designationLabel(r.designation) : '—',
        r.present, r.late, r.halfDay, r.absent, r.unmarked,
        r.workingDays, r.totalDays,
        `${r.percent}%`,
      ]),
      styles: {
        font: 'helvetica', fontSize: 9, cellPadding: 6,
        textColor: [26, 26, 26],
        lineColor: [226, 232, 240], lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [212, 168, 67], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 9,
      },
      alternateRowStyles: { fillColor: [251, 250, 245] },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: 'bold' },
        1: { cellWidth: 100 },
        2: { cellWidth: 48, halign: 'center' },
        3: { cellWidth: 40, halign: 'center' },
        4: { cellWidth: 55, halign: 'center' },
        5: { cellWidth: 48, halign: 'center' },
        6: { cellWidth: 60, halign: 'center' },
        7: { cellWidth: 55, halign: 'center' },
        8: { cellWidth: 45, halign: 'center' },
        9: { cellWidth: 78, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        // Colour the attendance % cell (last column) by band —
        // makes it easy to scan for people below 75%.
        if (data.section === 'body' && data.column.index === 9) {
          const p = parseInt(String(data.cell.raw), 10);
          if (p >= 90)      data.cell.styles.textColor = [21, 128, 61];
          else if (p >= 75) data.cell.styles.textColor = [180, 83, 9];
          else              data.cell.styles.textColor = [185, 28, 28];
        }
      },
      didDrawPage: () => this.drawPdfFooter(doc),
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
    });

    const from = this.toIsoDate(this.fromDate);
    const to   = this.toIsoDate(this.toDate);
    doc.save(`attendance-summary_${from}_to_${to}.pdf`);
  }

  private exportDetailedPdf(): void {
    const rows = this.gridRows;
    if (rows.length === 0) {
      this.snack.open('No data to export', 'Close', { duration: 2500 });
      return;
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    this.drawPdfHeader(doc, 'Attendance Report — Detailed grid');

    // Full grid could exceed page width for long ranges — jsPDF
    // autoTable handles that by wrapping columns to the next page
    // section automatically.
    const dateHeaders = this.dateColumns.map(d => this.formatColHeader(d));
    autoTable(doc, {
      startY: 108,
      head: [['Employee', ...dateHeaders]],
      body: rows.map(row => [
        row.name,
        ...this.dateColumns.map(d => this.cellLabel(row.cells.get(d), d)),
      ]),
      styles: {
        font: 'helvetica', fontSize: 8, cellPadding: 4,
        textColor: [26, 26, 26], halign: 'center',
        lineColor: [226, 232, 240], lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [212, 168, 67], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 8, halign: 'center',
      },
      alternateRowStyles: { fillColor: [251, 250, 245] },
      columnStyles: { 0: { cellWidth: 130, halign: 'left', fontStyle: 'bold' } },
      // Colour code the day cells so the printed grid reads like
      // the on-screen colour map.
      didParseCell: (data: any) => {
        if (data.section !== 'body' || data.column.index === 0) return;
        const v = String(data.cell.raw);
        if (v === 'P')       data.cell.styles.textColor = [21, 128, 61];
        else if (v === 'L')  data.cell.styles.textColor = [180, 83, 9];
        else if (v === 'H')  data.cell.styles.textColor = [126, 34, 206];
        else if (v === 'A')  data.cell.styles.textColor = [185, 28, 28];
        else if (v === 'HO') { data.cell.styles.textColor = [29, 78, 216]; data.cell.styles.fillColor = [219, 234, 254]; }
        else if (v === 'WO') { data.cell.styles.textColor = [100, 116, 139]; data.cell.styles.fillColor = [241, 245, 249]; }
        else                 data.cell.styles.textColor = [148, 163, 184];
      },
      didDrawPage: () => this.drawPdfFooter(doc),
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
    });

    const from = this.toIsoDate(this.fromDate);
    const to   = this.toIsoDate(this.toDate);
    doc.save(`attendance-detailed_${from}_to_${to}.pdf`);
  }

  /** Common title block — gold accent bar + title + date range +
   *  designation filter chip if one is active. */
  private drawPdfHeader(doc: jsPDF, title: string): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(212, 168, 67);
    doc.rect(0, 0, pageWidth, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 26);
    doc.text(title, 40, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    const range = this.formatDateReadable(this.fromDate) + '  —  ' + this.formatDateReadable(this.toDate);
    doc.text(range, 40, 58);

    const filters: string[] = [];
    if (this.designationFilter !== 'ALL') filters.push('Designation: ' + this.designationLabel(this.designationFilter));
    if (this.statusFilter !== 'ALL')      filters.push('Status: ' + this.statusFilter);
    if (this.searchQuery.trim())          filters.push('Search: "' + this.searchQuery.trim() + '"');
    if (filters.length) {
      doc.text('Filters — ' + filters.join(' · '), 40, 74);
    }
  }

  /** 7-cell KPI strip mirroring the on-screen row (Summary export
   *  only — the detailed grid is dense enough without it). */
  private drawKpiStrip(doc: jsPDF): void {
    const k = this.kpis;
    const pageWidth = doc.internal.pageSize.getWidth();
    const y = 92;
    const boxW = (pageWidth - 80) / 7;
    const stats: Array<[string, string | number, [number, number, number]]> = [
      ['Employees',   k.totalEmployees,           [37, 99, 235]],
      ['Days',        k.totalDays,                [212, 168, 67]],
      ['Attendance %',`${k.avgAttendance}%`,      [34, 197, 94]],
      ['Late',        k.late,                     [245, 158, 11]],
      ['Half-day',    k.halfDay,                  [168, 85, 247]],
      ['Absent',      k.absent,                   [239, 68, 68]],
      ['Unmarked',    k.unmarked,                 [148, 163, 184]],
    ];
    stats.forEach(([label, value, rgb], i) => {
      const x = 40 + i * boxW;
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(x, y, 3, 42, 'F');
      doc.setFillColor(251, 250, 245);
      doc.rect(x + 3, y, boxW - 6, 42, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(26, 26, 26);
      doc.text(String(value), x + 10, y + 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(String(label).toUpperCase(), x + 10, y + 34);
    });
  }

  /** Footer on every page — export timestamp + page number. */
  private drawPdfFooter(doc: jsPDF): void {
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const now = new Date();
    const ts = now.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated ${ts}`, 40, pageHeight - 20);
    const pageStr = `Page ${doc.getNumberOfPages()}`;
    doc.text(pageStr, pageWidth - 40 - doc.getTextWidth(pageStr), pageHeight - 20);
  }

  private formatDateReadable(d: Date): string {
    return d.toLocaleDateString('en-IN',
      { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Helpers ─────────────────────────────────────

  private csvEscape(s: string): string {
    if (s == null) return '';
    // Wrap in quotes if the value contains a comma, quote, or newline.
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  private download(filename: string, content: string): void {
    // BOM so Excel auto-detects UTF-8 for non-ASCII names.
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  /** Compact "Mon 5" for the detailed grid column header. */
  formatColHeader(iso: string): string {
    const d = new Date(iso);
    const dow = d.toLocaleDateString('en-IN', { weekday: 'short' });
    return `${dow} ${d.getDate()}`;
  }

  isWeekend(iso: string): boolean {
    const d = new Date(iso).getDay();
    return d === 0 || d === 6;
  }
}
