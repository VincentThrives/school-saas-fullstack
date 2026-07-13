import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

type HomeworkStatus = 'DONE' | 'HALF' | 'PENDING';

interface RosterRow {
  studentId: string;
  fullName: string;
  rollNumber?: string;
  status: HomeworkStatus;
  remark: string;
}

@Component({
  selector: 'app-homework-roster',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './homework-roster.component.html',
  styleUrl: './homework-roster.component.scss',
})
export class HomeworkRosterComponent implements OnInit {
  homeworkId = '';
  homework: any = null;
  rows: RosterRow[] = [];
  isLoading = true;
  isSaving = false;

  /** 0 = All, 1 = Not done, 2 = Half done, 3 = Done. Filter for the
   *  currently-visible slice of the roster. Save always persists the
   *  WHOLE roster regardless of the active tab. */
  activeTab = 0;

  /** Free-text filter — matches student name (case-insensitive) OR
   *  the roll number prefix. Applied on top of the active tab so a
   *  teacher can scope to "Not done → Aditya" in a class of 60. */
  searchQuery = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.homeworkId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.homeworkId) {
      this.router.navigate(['/homework']);
      return;
    }
    this.load();
  }

  load(): void {
    this.isLoading = true;
    // Roster gives us students + status + remark. Students who've
    // never been touched come back with status=null; we default them
    // to DONE so the teacher only has to change the ones who didn't
    // do the homework instead of ticking every child who did.
    this.api.getHomeworkRoster(this.homeworkId).subscribe({
      next: (res) => {
        const data = res?.data as any;
        this.rows = (data?.students || []).map((s: any) => ({
          studentId: s.studentId,
          fullName: s.fullName,
          rollNumber: s.rollNumber,
          status: (s.status as HomeworkStatus) || 'DONE',
          remark: s.remark || '',
        }));
        this.isLoading = false;
      },
      error: () => {
        this.rows = [];
        this.isLoading = false;
        this.snackBar.open('Could not load roster', 'Close', { duration: 3000 });
      },
    });
    // Load the homework header (title + body) via the same batched
    // homework fetch used elsewhere — we filter by the row's id since
    // there's no single-notification GET endpoint today.
    this.loadHeader();
  }

  private loadHeader(): void {
    // Cheap approach: the notifications GET-with-filter endpoint we
    // already use. In practice the roster page is opened from the
    // list, so we could pass the homework in via navigation state
    // to avoid this call; keeping it standalone so a direct URL open
    // still populates the header.
    // Just fetch by today's date — good enough for most cases;
    // deeper history still resolves via the roster call so nothing
    // breaks if the header is missing.
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    this.api.getHomeworkNotifications(dateStr, 0, 200, true).subscribe({
      next: (res) => {
        const items = (res?.data as any)?.content || [];
        this.homework = items.find((h: any) => h.notificationId === this.homeworkId) || null;
      },
    });
  }

  /** Tabs: 0=All, 1=Pending, 2=Half, 3=Done. Pending covers the
   *  "chase these students" bucket the teacher wants front-and-centre.
   *  Search query further filters by name / roll number so a teacher
   *  can jump straight to a specific student in a large class. */
  get visibleRows(): RosterRow[] {
    let out = this.rows;
    if (this.activeTab === 1) out = out.filter((r) => r.status === 'PENDING');
    else if (this.activeTab === 2) out = out.filter((r) => r.status === 'HALF');
    else if (this.activeTab === 3) out = out.filter((r) => r.status === 'DONE');
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) return out;
    return out.filter((r) =>
      (r.fullName || '').toLowerCase().includes(q)
      || (r.rollNumber || '').toLowerCase().includes(q));
  }

  get doneCount(): number { return this.rows.filter((r) => r.status === 'DONE').length; }
  get halfCount(): number { return this.rows.filter((r) => r.status === 'HALF').length; }
  get pendingCount(): number { return this.rows.filter((r) => r.status === 'PENDING').length; }

  save(notifyUndone: boolean): void {
    if (this.isSaving) return;
    this.isSaving = true;
    const payload = this.rows.map((r) => ({
      studentId: r.studentId,
      status: r.status,
      remark: (r.remark || '').trim(),
    }));
    this.api.batchSaveHomeworkCompletions(this.homeworkId, payload, notifyUndone).subscribe({
      next: (res) => {
        this.isSaving = false;
        const notified = (res?.data as any)?.notified ?? 0;
        const msg = notifyUndone
          ? notified > 0
            ? `Saved. Reminder sent to ${notified} student${notified === 1 ? '' : 's'}.`
            : 'Saved. No pending students to notify.'
          : 'Saved.';
        this.snackBar.open(msg, 'Close', { duration: 3500 });
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Save failed. Try again.', 'Close', { duration: 3500 });
      },
    });
  }

  trackByStudentId(_index: number, row: RosterRow): string {
    return row.studentId;
  }

  formatSentAt(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
