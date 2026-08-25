import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService, TodayPunch } from '../../../core/services/api.service';

interface DialogData {
  serial: string;
  label: string;
}

/**
 * "Today's Punches" audit dialog for one terminal — shows every scan
 * received today, both RECORDED (fed attendance + fired parent SMS)
 * and DROPPED (accidental re-tap, past exit window, etc). The drop
 * reason column is the answer to "why didn't the parent get a text
 * when Rahul walked past at 11:00?".
 */
@Component({
  selector: 'app-today-punches-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule, MatTooltipModule,
  ],
  templateUrl: './today-punches-dialog.component.html',
  styleUrl: './today-punches-dialog.component.scss',
})
export class TodayPunchesDialogComponent implements OnInit {
  punches: TodayPunch[] = [];
  isLoading = false;
  loadError = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<TodayPunchesDialogComponent>,
    private api: ApiService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading = true;
    this.loadError = '';
    this.api.getTodaysPunches(this.data.serial).subscribe({
      next: (res) => {
        this.punches = res?.data || [];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = err?.error?.message || 'Failed to load today\'s punches';
      },
    });
  }

  /** HH:mm:ss in the viewer's local zone — Indian browsers render IST. */
  formatTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  /** Split counters shown in the dialog header — helps admins scan
   *  "we got 47 taps today; 12 real, 35 accidental" at a glance. */
  get recordedCount(): number {
    return this.punches.filter(p => p.outcome === 'RECORDED').length;
  }
  get droppedCount(): number {
    return this.punches.filter(p => p.outcome !== 'RECORDED').length;
  }

  /** Group the flat scan list by student so the audit table shows one
   *  row per student — first IN, first OUT, and everything else (dropped
   *  scans AND unexpected RECORDED duplicates) as extras chips. Sorted
   *  by the earliest scan of each student. */
  get grouped(): StudentPunchRow[] {
    const byStudent = new Map<string, StudentPunchRow>();
    // Process oldest → newest so the FIRST IN/OUT sticks and any later
    // duplicates fall through to the extras column. Backend returns
    // newest first for the flat list, so we reverse here.
    const ordered = [...this.punches].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
    for (const p of ordered) {
      const key = p.studentId || ('tuid:' + p.terminalUserId);
      let row = byStudent.get(key);
      if (!row) {
        row = {
          studentId: p.studentId,
          studentName: p.studentName,
          terminalUserId: p.terminalUserId,
          in: null,
          out: null,
          extras: [],
          firstScanIso: p.scannedAt,
        };
        byStudent.set(key, row);
      }
      // First IN wins for the arrival column; later INs (should be
      // dropped by backend, but if any slip through as RECORDED they
      // land in extras so admins spot them).
      if (p.outcome === 'RECORDED' && p.direction === 'IN' && !row.in) {
        row.in = { time: this.formatTime(p.scannedAt) };
      } else if (p.outcome === 'RECORDED' && p.direction === 'OUT' && !row.out) {
        row.out = { time: this.formatTime(p.scannedAt) };
      } else {
        // Everything else — dropped scans (expected noise) PLUS any
        // RECORDED duplicates that leaked past decide() (backend bug or
        // stale data). The `unexpected` flag drives an amber warning
        // chip so admins can spot leaks that a clean audit shouldn't
        // have; regular drops get the muted grey chip.
        row.extras.push({
          time: this.formatTime(p.scannedAt),
          direction: p.direction || '',
          reason: p.dropReason
            || (p.outcome === 'RECORDED'
                ? 'Unexpected duplicate — recorded when it should have been dropped'
                : 'Dropped'),
          unexpected: p.outcome === 'RECORDED',
        });
      }
    }
    return Array.from(byStudent.values())
      .sort((a, b) => (a.firstScanIso || '').localeCompare(b.firstScanIso || ''));
  }

  close(): void { this.dialogRef.close(); }
}

/** One row in the grouped audit table — collapses all of one student's
 *  taps for the day into a single line: IN, OUT, and any extras. */
interface StudentPunchRow {
  studentId: string;
  studentName?: string;
  terminalUserId: string;
  in: { time: string } | null;
  out: { time: string } | null;
  extras: Array<{ time: string; direction: string; reason: string; unexpected: boolean }>;
  /** ISO of the earliest scan seen for this student — used to sort
   *  the grouped list so early arrivals appear first. */
  firstScanIso: string;
}
