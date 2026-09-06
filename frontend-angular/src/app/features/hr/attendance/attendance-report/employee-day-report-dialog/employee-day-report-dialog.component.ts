import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HrDailyAttendance } from '../../../../../core/models';

/**
 * Per-employee day-by-day breakdown popup. Opened when the HR user
 * clicks a row in the summary table on the Attendance Report page.
 *
 * <p>Shows every date in the picked range with the employee's status
 * for that day — Present / Late / Half-day / Absent / Unmarked / Week-off —
 * along with the IN + OUT times and a computed duration. The Excel
 * button below the table exports just this employee's rows so an HR
 * admin can attach one person's month to a payroll or leave request.</p>
 */
export interface EmployeeDayReportData {
  employeeId: string;
  employeeName: string;
  designation?: string;
  fromDate: Date;
  toDate: Date;
  dateColumns: string[];
  rows: HrDailyAttendance[];
  /** Declared holidays overlapping the range — passed from parent
   *  so the dialog can render HOLIDAY chips + exclude them from the
   *  working-days denominator, and mirror the honesty of the summary
   *  page's % calc. */
  holidayDates?: string[];
  /** Holiday date → name map for tooltips. */
  holidayNames?: Map<string, string>;
}

type DayStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'UNMARKED' | 'WEEKOFF' | 'HOLIDAY';

interface DayRow {
  dateIso: string;
  weekday: string;
  isWeekend: boolean;
  status: DayStatus;
  inTime?: string;
  outTime?: string;
  durationLabel: string;
  remarks?: string;
}

@Component({
  selector: 'app-employee-day-report-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './employee-day-report-dialog.component.html',
  styleUrl: './employee-day-report-dialog.component.scss',
})
export class EmployeeDayReportDialogComponent {

  rows: DayRow[] = [];

  totals = {
    present: 0, late: 0, halfDay: 0, absent: 0, unmarked: 0, weekOff: 0, holiday: 0,
    totalDays: 0, workingDays: 0, percent: 0,
  };

  /** yyyy-MM-dd Set for O(1) holiday lookups from the injected data. */
  private holidaySet = new Set<string>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EmployeeDayReportData,
    private ref: MatDialogRef<EmployeeDayReportDialogComponent>,
  ) {
    this.holidaySet = new Set<string>(data.holidayDates || []);
    this.buildRows();
    this.buildTotals();
  }

  /** Weave the fetched rows into every calendar day in the range.
   *  Priority for a day WITHOUT an attendance row:
   *    Sunday → WEEKOFF
   *    Holiday → HOLIDAY (tenant-declared, tooltip carries name)
   *    else → UNMARKED
   *  A row on a Sunday / holiday overrides the WEEKOFF/HOLIDAY tag
   *  with the actual attendance status — employees who worked on
   *  their off day are surfaced as PRESENT / LATE / etc, not hidden. */
  private buildRows(): void {
    const byDate = new Map<string, HrDailyAttendance>();
    for (const r of this.data.rows) byDate.set(r.date, r);

    for (const iso of this.data.dateColumns) {
      const d = new Date(iso);
      const dow = d.getDay();
      const isSunday = dow === 0;
      const isHoliday = this.holidaySet.has(iso);
      const row = byDate.get(iso);
      const status: DayStatus = row
        ? (row.late ? 'LATE' : (row.status as any) || 'UNMARKED')
        : (isSunday ? 'WEEKOFF' : (isHoliday ? 'HOLIDAY' : 'UNMARKED'));

      // Remarks: use the row's remarks if present, else the holiday
      // name if that's the reason the day is off.
      let remarks = row?.remarks;
      if (!remarks && isHoliday && !row) {
        remarks = this.data.holidayNames?.get(iso) || 'Holiday';
      }

      this.rows.push({
        dateIso: iso,
        weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        isWeekend: isSunday || isHoliday,
        status,
        inTime: row?.inTime,
        outTime: row?.outTime,
        durationLabel: this.durationLabel(row?.inTime, row?.outTime),
        remarks,
      });
    }
  }

  private buildTotals(): void {
    for (const r of this.rows) {
      if (r.status === 'PRESENT')       this.totals.present++;
      else if (r.status === 'LATE')     this.totals.late++;
      else if (r.status === 'HALF_DAY') this.totals.halfDay++;
      else if (r.status === 'ABSENT')   this.totals.absent++;
      else if (r.status === 'WEEKOFF')  this.totals.weekOff++;
      else if (r.status === 'HOLIDAY')  this.totals.holiday++;
      else                              this.totals.unmarked++;
    }
    this.totals.totalDays = this.rows.length;
    // Working days = calendar days − week-offs − holidays, then
    // + any off-day this employee actually worked on (their row on
    // that day already counted as P/L/H — the off-day chip was
    // suppressed for them). Mirror of the summary page's math.
    const offDaysWorked = this.rows.filter(r =>
      (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY')
      && (new Date(r.dateIso).getDay() === 0 || this.holidaySet.has(r.dateIso)),
    ).length;
    const baseWorking = this.totals.totalDays - this.totals.weekOff - this.totals.holiday;
    this.totals.workingDays = baseWorking + offDaysWorked;
    const attendedEq = this.totals.present + this.totals.late + this.totals.halfDay * 0.5;
    this.totals.percent = this.totals.workingDays > 0
      ? Math.round((attendedEq / this.totals.workingDays) * 100)
      : 0;
  }

  private durationLabel(inIso?: string, outIso?: string): string {
    if (!inIso || !outIso) return '—';
    const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
    if (ms < 0) return 'Invalid';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  formatTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN',
      { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDateLong(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN',
      { day: '2-digit', month: 'short', year: 'numeric' });
  }

  statusChipClass(s: DayStatus): string {
    return `chip chip--${s.toLowerCase().replace('_', '-')}`;
  }

  statusLabel(s: DayStatus): string {
    switch (s) {
      case 'PRESENT':  return 'Present';
      case 'LATE':     return 'Late';
      case 'HALF_DAY': return 'Half-day';
      case 'ABSENT':   return 'Absent';
      case 'WEEKOFF':  return 'Week-off';
      case 'HOLIDAY':  return 'Holiday';
      default:         return 'Unmarked';
    }
  }

  designationLabel(d?: string): string {
    if (!d) return '';
    return d.split('_')
      .map(w => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  // ── Export ──────────────────────────────────────

  /** CSV export of just this employee's day-by-day rows. Uses
   *  the same CSV/BOM technique as the parent page — Excel opens
   *  it natively and every desktop spreadsheet program picks up
   *  the UTF-8 encoding. */
  exportCsv(): void {
    const header = ['Date', 'Day', 'Status', 'IN', 'OUT', 'Duration', 'Remarks'];
    const lines = [
      header.map(this.csvEscape).join(','),
      ...this.rows.map(r => [
        r.dateIso,
        r.weekday,
        this.statusLabel(r.status),
        this.formatTime(r.inTime),
        this.formatTime(r.outTime),
        r.durationLabel,
        r.remarks || '',
      ].map(v => this.csvEscape(String(v))).join(',')),
      '',   // blank line between rows and summary
      ['Summary', '', '', '', '', '', ''].map(this.csvEscape).join(','),
      ['Present',   String(this.totals.present)].map(this.csvEscape).join(','),
      ['Late',      String(this.totals.late)].map(this.csvEscape).join(','),
      ['Half-day',  String(this.totals.halfDay)].map(this.csvEscape).join(','),
      ['Absent',    String(this.totals.absent)].map(this.csvEscape).join(','),
      ['Unmarked',  String(this.totals.unmarked)].map(this.csvEscape).join(','),
      ['Week-off',  String(this.totals.weekOff)].map(this.csvEscape).join(','),
      ['Total days',String(this.totals.totalDays)].map(this.csvEscape).join(','),
      ['Attendance %', `${this.totals.percent}%`].map(this.csvEscape).join(','),
    ];
    const safeName = (this.data.employeeName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
    const from = this.toIso(this.data.fromDate);
    const to   = this.toIso(this.data.toDate);
    const filename = `${safeName}_attendance_${from}_to_${to}.csv`;
    this.download(filename, lines.join('\r\n'));
  }

  /** Real PDF built programmatically with jsPDF + autoTable rather
   *  than window.print() — printing the on-screen surface produced
   *  a page full of app chrome (sidebar + hover tooltips + browser
   *  print artifacts). The generated document has a proper title
   *  block, summary strip, day-by-day table with paged headers, and
   *  a footer with the export timestamp. */
  exportPdf(): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ── Header block ──────────────────────────────
    doc.setFillColor(212, 168, 67);          // gold accent bar
    doc.rect(0, 0, pageWidth, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 26);
    doc.text('Attendance Report', 40, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(this.data.employeeName || '(unnamed)', 40, 60);

    doc.setFontSize(9);
    const rangeLabel =
      this.formatDateLong(this.data.dateColumns[0]) + '  —  ' +
      this.formatDateLong(this.data.dateColumns[this.data.dateColumns.length - 1]);
    doc.text(rangeLabel, 40, 76);
    if (this.data.designation) {
      doc.text('Designation: ' + this.designationLabel(this.data.designation), 40, 90);
    }

    // ── Summary strip (7 stat boxes) ──────────────
    const summaryY = 108;
    const boxW = (pageWidth - 80) / 7;
    const stats: Array<[string, string | number, [number, number, number]]> = [
      ['Present',    this.totals.present,   [34, 197, 94]],
      ['Late',       this.totals.late,      [245, 158, 11]],
      ['Half-day',   this.totals.halfDay,   [168, 85, 247]],
      ['Absent',     this.totals.absent,    [239, 68, 68]],
      ['Unmarked',   this.totals.unmarked,  [148, 163, 184]],
      ['Week-off',   this.totals.weekOff,   [203, 213, 225]],
      ['Attendance', `${this.totals.percent}%`, [184, 134, 11]],
    ];
    stats.forEach(([label, value, rgb], i) => {
      const x = 40 + i * boxW;
      // Left colour bar
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(x, summaryY, 3, 42, 'F');
      // Card body
      doc.setFillColor(251, 250, 245);
      doc.rect(x + 3, summaryY, boxW - 6, 42, 'F');
      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(26, 26, 26);
      doc.text(String(value), x + 10, summaryY + 20);
      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(String(label).toUpperCase(), x + 10, summaryY + 34);
    });

    // ── Day-by-day table ──────────────────────────
    const body = this.rows.map(r => [
      r.dateIso,
      r.weekday,
      this.statusLabel(r.status),
      this.formatTime(r.inTime),
      this.formatTime(r.outTime),
      r.durationLabel,
      r.remarks || '',
    ]);

    autoTable(doc, {
      startY: summaryY + 60,
      head: [['Date', 'Day', 'Status', 'IN', 'OUT', 'Duration', 'Remarks']],
      body,
      styles: {
        font: 'helvetica', fontSize: 9,
        cellPadding: 6, textColor: [26, 26, 26],
        lineColor: [226, 232, 240], lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [212, 168, 67], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 9,
      },
      alternateRowStyles: { fillColor: [251, 250, 245] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 40 },
        2: { cellWidth: 65, fontStyle: 'bold' },
        3: { cellWidth: 60 },
        4: { cellWidth: 60 },
        5: { cellWidth: 55 },
        6: { cellWidth: 'auto' },
      },
      // Colour the Status cell by value so a scan of the table
      // reads the same as the on-screen chip colours.
      didParseCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== 2) return;
        const label = String(data.cell.raw);
        if (label === 'Present')       data.cell.styles.textColor = [21, 128, 61];
        else if (label === 'Late')     data.cell.styles.textColor = [180, 83, 9];
        else if (label === 'Half-day') data.cell.styles.textColor = [126, 34, 206];
        else if (label === 'Absent')   data.cell.styles.textColor = [185, 28, 28];
        else if (label === 'Unmarked') data.cell.styles.textColor = [71, 85, 105];
        else if (label === 'Week-off') data.cell.styles.textColor = [100, 116, 139];
      },
      didDrawPage: () => {
        // Footer on every page — page number + export timestamp.
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
      },
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
    });

    const safeName = (this.data.employeeName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
    const from = this.toIso(this.data.fromDate);
    const to   = this.toIso(this.data.toDate);
    doc.save(`${safeName}_attendance_${from}_to_${to}.pdf`);
  }

  close(): void { this.ref.close(); }

  // ── Helpers ─────────────────────────────────────

  private csvEscape(s: string): string {
    if (s == null) return '';
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  private download(filename: string, content: string): void {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
