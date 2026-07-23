import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface SubjectSpec {
  subjectId: string;
  subjectName: string;
  maxMarks: number;
}

interface StudentRow {
  studentId: string;
  rollNumber: string | null;
  fullName: string;
  remark: string | null;
  /** Keyed by subjectId → marks value entered in the cell. */
  marksBySubject: Record<string, number | null>;
  /** Standard class rank on this assessment. Null until the row has
   *  at least one mark AND the admin has saved — server computes it
   *  on save and returns it on the response payload. */
  rank: number | null;
}

/**
 * Assessment detail — spreadsheet-style marks entry. Admin picks
 * subjects across the top, students down the side. Save posts the
 * whole roster back to the backend (full replace of the students[]
 * array, no diff protocol needed).
 */
@Component({
  selector: 'app-other-assessment-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './other-assessment-detail.component.html',
  styleUrl: './other-assessment-detail.component.scss',
})
export class OtherAssessmentDetailComponent implements OnInit {
  assessmentId = '';
  isLoading = false;
  isSaving = false;

  assessment: any = null;
  subjects: SubjectSpec[] = [];
  rows: StudentRow[] = [];

  searchQuery = '';

  /** Bulk upload popup open state — UI-only for now, backing endpoints
   *  will be wired in the next round. */
  uploadDialogOpen = false;

  /** Whether the download-template request should include the Roll
   *  No column. Some schools keep roll numbers loose; unchecking
   *  produces a sheet keyed only by admission number. */
  templateIncludeRoll = true;

  /** Result summary from the last bulk-upload attempt, or null when
   *  no upload has run yet in this session. Rendered in the popup
   *  so admins can see unmatched adm nos and validation errors. */
  uploadResult: {
    matched: number;
    unmatched: string[];
    invalidRows: string[];
    missingSubjectHeaders: string[];
  } | null = null;

  isUploading = false;

  /** Inline error surfaced under the Upload File tile when the
   *  backend rejects the file (wrong assessment, missing headers,
   *  etc.). Cleared when the popup reopens or a fresh upload starts. */
  uploadError: string | null = null;

  /** File the admin has picked but not yet confirmed to upload —
   *  the flow is two-step (pick → confirm) so an accidental double-
   *  click on the tile can't overwrite marks unintentionally. */
  pendingFile: File | null = null;

  /** Notification preview popup state. Two-step flow: admin clicks
   *  Notify → preview loads → admin clicks Send. Body/title come from
   *  the server so any last-minute mark edit is reflected. */
  notifyDialogOpen = false;
  notifyPreview: {
    title: string;
    body: string;
    sampleStudentName: string | null;
    studentCount: number;
    parentCount: number;
    totalRecipients: number;
  } | null = null;
  isPreviewingNotify = false;
  isSendingNotify = false;

  /** True when there's at least one saved rank on the roster —
   *  drives the "Notify" button's enabled state. Sending before
   *  marks are saved would blast an empty template out. */
  get canNotify(): boolean {
    return this.rows.some((r) => r.rank !== null);
  }

  /** Reference to the hidden <input type="file"> that drives the
   *  Upload File choice — clicking the tile programmatically opens
   *  the OS file picker, so no visible input clutters the popup. */
  @ViewChild('uploadInput') uploadInput?: ElementRef<HTMLInputElement>;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.assessmentId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.assessmentId) {
      this.router.navigate(['/other-assessments']);
      return;
    }
    this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.api.getOtherAssessment(this.assessmentId).subscribe({
      next: (res) => {
        this.assessment = res?.data;
        this.subjects = (this.assessment?.subjects || []) as SubjectSpec[];
        this.rows = ((this.assessment?.students || []) as any[]).map((s) => {
          const marksBySubject: Record<string, number | null> = {};
          for (const sub of this.subjects) marksBySubject[sub.subjectId] = null;
          for (const m of (s.subjects || [])) {
            if (m?.subjectId) {
              marksBySubject[m.subjectId] = m.marksObtained ?? null;
            }
          }
          return {
            studentId: s.studentId,
            rollNumber: s.rollNumber,
            fullName: s.fullName,
            remark: s.remark ?? null,
            marksBySubject,
            rank: typeof s.rank === 'number' ? s.rank : null,
          };
        });
        // Older saves may not have rank stored; recompute so the
        // Rank column paints correctly on first render.
        this.recomputeRanks();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load assessment', 'Close', { duration: 3000 });
      },
    });
  }

  get visibleRows(): StudentRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter((r) =>
        r.fullName.toLowerCase().includes(q)
        || (r.rollNumber || '').toLowerCase().includes(q));
  }

  totalOf(row: StudentRow): number {
    let sum = 0;
    for (const sub of this.subjects) {
      const v = row.marksBySubject[sub.subjectId];
      if (typeof v === 'number' && !isNaN(v)) sum += v;
    }
    return sum;
  }

  totalMax(): number {
    return this.subjects.reduce((s, sub) => s + (sub.maxMarks || 0), 0);
  }

  /** Clamp entered marks to the subject's max — no way for an admin
   *  to save 90 into a 40-mark Physics slot. Anything under zero
   *  snaps to zero, anything over max snaps to max. Null / empty
   *  passes through so a blank cell stays blank.
   *
   *  Also recomputes ranks locally so the Rank column tracks each
   *  keystroke instead of waiting for a save round-trip. The server
   *  re-runs the same algorithm on save — this is just the mirror
   *  the admin sees while typing. */
  onMarkChange(row: StudentRow, subject: SubjectSpec, value: any): void {
    if (value === null || value === undefined || value === '') {
      row.marksBySubject[subject.subjectId] = null;
    } else {
      let num = Number(value);
      if (isNaN(num)) {
        row.marksBySubject[subject.subjectId] = null;
      } else {
        const max = subject.maxMarks;
        if (num < 0) num = 0;
        if (typeof max === 'number' && num > max) num = max;
        row.marksBySubject[subject.subjectId] = num;
      }
    }
    this.recomputeRanks();
  }

  /** Local mirror of the server's rank algorithm — standard ranking
   *  (1, 2, 2, 4) by row total. Rows with no marks stay unranked
   *  (rank = null → "—" in the UI). Runs on every keystroke so what
   *  the admin sees always matches what a save would produce. */
  private recomputeRanks(): void {
    interface RankRow { row: StudentRow; hasAny: boolean; total: number; }
    const totals: RankRow[] = this.rows.map((r) => {
      let sum = 0;
      let any = false;
      for (const sub of this.subjects) {
        const v = r.marksBySubject[sub.subjectId];
        if (typeof v === 'number' && !isNaN(v)) { sum += v; any = true; }
      }
      r.rank = null;
      return { row: r, hasAny: any, total: sum };
    });
    totals.sort((a, b) => b.total - a.total);
    let position = 0;
    let currentRank = 0;
    let lastTotal: number | null = null;
    for (const t of totals) {
      if (!t.hasAny) continue;
      position++;
      if (lastTotal === null || t.total !== lastTotal) {
        currentRank = position;
        lastTotal = t.total;
      }
      t.row.rank = currentRank;
    }
  }

  /** Spreadsheet-style navigation across the marks grid:
   *  <ul>
   *    <li>ArrowDown / Enter → next student in the same column</li>
   *    <li>ArrowUp → previous student in the same column</li>
   *    <li>ArrowRight → next subject on the same student</li>
   *    <li>ArrowLeft → previous subject on the same student</li>
   *  </ul>
   *  Native number-input arrows are hidden via CSS so they can't
   *  fight the row-move behaviour. Left / right work at the caret
   *  edges only — inside a value the arrows still move the caret
   *  through the number, so admins can correct a typo without
   *  jumping cells. */
  onMarkKeydown(event: KeyboardEvent, row: StudentRow, colIdx: number): void {
    const key = event.key;
    const isVertical = key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter';
    const isHorizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    if (!isVertical && !isHorizontal) return;

    // Left/right always jump columns on number inputs. Browsers
    // don't expose selectionStart/selectionEnd for type="number", so
    // there's no reliable way to detect a caret-edge press — trying
    // to be clever meant ArrowRight was silently swallowed at
    // positions we couldn't measure. Column jumps beat caret nudges
    // for a marks-entry spreadsheet.

    event.preventDefault();
    const list = this.visibleRows;
    const rowIdx = list.findIndex((r) => r.studentId === row.studentId);
    if (rowIdx < 0) return;

    let nextRowIdx = rowIdx;
    let nextColIdx = colIdx;
    if (key === 'ArrowUp') {
      nextRowIdx = Math.max(0, rowIdx - 1);
    } else if (key === 'ArrowDown' || key === 'Enter') {
      nextRowIdx = Math.min(list.length - 1, rowIdx + 1);
    } else if (key === 'ArrowLeft') {
      nextColIdx = Math.max(0, colIdx - 1);
    } else if (key === 'ArrowRight') {
      nextColIdx = Math.min(this.subjects.length - 1, colIdx + 1);
    }
    if (nextRowIdx === rowIdx && nextColIdx === colIdx) return;

    const nextRow = list[nextRowIdx];
    // Give the DOM a tick to catch up if the search filter is
    // narrowing rows underneath us, then focus.
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
          `input.oa-mark-input[data-student-id="${nextRow.studentId}"][data-col="${nextColIdx}"]`);
      if (el) {
        el.focus();
        el.select();
      }
    });
  }

  save(): void {
    this.isSaving = true;
    const payload = this.rows.map((r) => ({
      studentId: r.studentId,
      rollNumber: r.rollNumber,
      fullName: r.fullName,
      remark: r.remark,
      subjects: this.subjects.map((sub) => ({
        subjectId: sub.subjectId,
        marksObtained: r.marksBySubject[sub.subjectId] ?? null,
      })),
    }));
    this.api.saveOtherAssessmentMarks(this.assessmentId, payload).subscribe({
      next: (res) => {
        // Server computes ranks on save — try to pull them off the
        // response, and fall back to a full reload so the Rank column
        // is guaranteed to reflect the freshly-saved state.
        const updated = (res?.data?.students || []) as any[];
        const rankById = new Map<string, number | null>();
        for (const s of updated) {
          if (s?.studentId != null) {
            rankById.set(s.studentId, typeof s.rank === 'number' ? s.rank : null);
          }
        }
        if (rankById.size > 0) {
          for (const row of this.rows) {
            if (rankById.has(row.studentId)) row.rank = rankById.get(row.studentId) ?? null;
          }
          this.isSaving = false;
          this.snackBar.open('Marks saved', 'Close', { duration: 2500 });
        } else {
          // Response envelope didn't carry the students array — refetch
          // so ranks still land in the table.
          this.api.getOtherAssessment(this.assessmentId).subscribe({
            next: (fresh) => {
              const students = (fresh?.data?.students || []) as any[];
              const byId = new Map<string, number | null>();
              for (const s of students) {
                if (s?.studentId != null) {
                  byId.set(s.studentId, typeof s.rank === 'number' ? s.rank : null);
                }
              }
              for (const row of this.rows) {
                if (byId.has(row.studentId)) row.rank = byId.get(row.studentId) ?? null;
              }
              this.isSaving = false;
              this.snackBar.open('Marks saved', 'Close', { duration: 2500 });
            },
            error: () => {
              this.isSaving = false;
              this.snackBar.open('Marks saved', 'Close', { duration: 2500 });
            },
          });
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Save failed', 'Close', { duration: 3500 });
      },
    });
  }

  back(): void {
    this.router.navigate(['/other-assessments']);
  }

  // ── Bulk upload popup ────────────────────────────────────────

  openUploadDialog(): void {
    this.uploadDialogOpen = true;
  }

  closeUploadDialog(): void {
    this.uploadDialogOpen = false;
    this.uploadResult = null;
    this.uploadError = null;
    this.pendingFile = null;
  }

  clearPendingFile(): void {
    this.pendingFile = null;
    this.uploadError = null;
    if (this.uploadInput?.nativeElement) this.uploadInput.nativeElement.value = '';
  }

  /** Streams the pre-filled marks template from the backend and
   *  triggers a browser download. */
  onDownloadTemplate(): void {
    this.api.downloadOtherAssessmentTemplate(this.assessmentId, this.templateIncludeRoll).subscribe({
      next: (resp) => {
        const blob = resp.body;
        if (!blob) {
          this.snackBar.open('Template download failed', 'Close', { duration: 3000 });
          return;
        }
        // Prefer the filename the server suggested in the
        // Content-Disposition header — falls back to a sane default
        // built from the assessment name if the header is missing.
        const disp = resp.headers.get('content-disposition') || '';
        const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disp);
        const suggested = match ? decodeURIComponent(match[1]) : null;
        const filename = suggested
            || `${(this.assessment?.name || 'assessment').replace(/[^A-Za-z0-9_-]+/g, '_')}_template.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.closeUploadDialog();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Template download failed',
            'Close', { duration: 3500 });
      },
    });
  }

  /** Opens the hidden file picker — actual work happens in
   *  {@link onFileChosen} once the admin picks a file. */
  onUploadFile(): void {
    this.uploadInput?.nativeElement?.click();
  }

  /** Called when the admin picks a file from the OS dialog — stores
   *  it as {@link pendingFile} for review. The actual upload only
   *  fires on {@link confirmUpload} (explicit second click). */
  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    this.pendingFile = file;
    this.uploadError = null;
    this.uploadResult = null;
  }

  /** Actually posts the pending file. Split from {@link onFileChosen}
   *  so admin gets a confirm-before-overwrite step. */
  confirmUpload(): void {
    if (!this.pendingFile || this.isUploading) return;
    const file = this.pendingFile;
    this.isUploading = true;
    this.uploadResult = null;
    this.uploadError = null;
    this.api.uploadOtherAssessmentMarks(this.assessmentId, file).subscribe({
      next: (res) => {
        this.isUploading = false;
        this.uploadResult = res?.data || null;
        this.pendingFile = null;
        if (this.uploadInput?.nativeElement) this.uploadInput.nativeElement.value = '';
        this.load();
        this.snackBar.open(
            `Uploaded — ${this.uploadResult?.matched ?? 0} students updated`,
            'Close', { duration: 3000 });
      },
      error: (err) => {
        this.isUploading = false;
        const msg = err?.error?.message || 'Upload failed';
        this.uploadError = msg;
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  // ── Notify preview + send ─────────────────────────────────

  openNotifyDialog(): void {
    if (!this.canNotify) return;
    this.notifyDialogOpen = true;
    this.notifyPreview = null;
    this.isPreviewingNotify = true;
    this.api.previewOtherAssessmentNotify(this.assessmentId).subscribe({
      next: (res) => {
        this.notifyPreview = res?.data || null;
        this.isPreviewingNotify = false;
      },
      error: (err) => {
        this.isPreviewingNotify = false;
        this.snackBar.open(err?.error?.message || 'Preview failed',
            'Close', { duration: 3500 });
        this.notifyDialogOpen = false;
      },
    });
  }

  closeNotifyDialog(): void {
    if (this.isSendingNotify) return;
    this.notifyDialogOpen = false;
    this.notifyPreview = null;
  }

  confirmNotify(): void {
    if (!this.notifyPreview || this.isSendingNotify) return;
    this.isSendingNotify = true;
    this.api.sendOtherAssessmentNotify(this.assessmentId).subscribe({
      next: (res) => {
        this.isSendingNotify = false;
        const r = res?.data || {};
        const students = r.notifiedStudents ?? 0;
        const parents = r.notifiedParents ?? 0;
        this.snackBar.open(
            `Sent to ${students} student${students === 1 ? '' : 's'}`
            + (parents > 0 ? ` + ${parents} parent${parents === 1 ? '' : 's'}` : ''),
            'Close', { duration: 3500 });
        this.notifyDialogOpen = false;
        this.notifyPreview = null;
      },
      error: (err) => {
        this.isSendingNotify = false;
        this.snackBar.open(err?.error?.message || 'Send failed',
            'Close', { duration: 4000 });
      },
    });
  }

  /** Human-readable size for the pending file chip. */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
