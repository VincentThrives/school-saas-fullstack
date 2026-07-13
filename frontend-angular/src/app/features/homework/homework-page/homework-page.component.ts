import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models';


@Component({
  selector: 'app-homework-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './homework-page.component.html',
  styleUrl: './homework-page.component.scss',
})
export class HomeworkPageComponent implements OnInit {
  /** Teacher's single-day picker. Defaults to today so teachers land
   *  on "what I posted today" without having to touch the picker. */
  selectedDate: Date = new Date();

  /** Student/parent date range — inclusive both ends. Defaults to the
   *  last 4 days (today−3 through today) so a student doesn't miss
   *  work assigned earlier in the week. Kept independent from
   *  {@link selectedDate} so the two modes can evolve separately. */
  fromDate: Date = (() => { const d = new Date(); d.setDate(d.getDate() - 3); return d; })();
  toDate: Date = new Date();

  /** Homework rows for {@link selectedDate}. Empty until the fetch
   *  completes; the loading spinner is driven by isLoading. */
  homework: any[] = [];
  isLoading = false;

  /** Detail popup — same shape as the Notifications inbox popup. */
  opened: any = null;

  /** Teachers view homework they SENT (sentByMe=true on the wire);
   *  students/parents see homework they RECEIVED. Kept as a boolean so
   *  the template and the API call share the same source of truth. */
  isTeacherMode = false;

  /** Per-homeworkId status. "DONE" | "HALF" | "PENDING" | null. Null
   *  means the teacher has never touched this student's entry, which
   *  reads as "Pending" in the UI. Non-null PENDING reads as
   *  "Not done" — an explicit teacher call rather than the default. */
  myStatus: Record<string, 'DONE' | 'HALF' | 'PENDING' | null> = {};

  /** Teacher-side per-homework roll of students who are still not
   *  fully done. Batched fetch so N cards → 1 request. */
  undone: Record<string, Array<{studentId: string; fullName: string; rollNumber: string | null; status: 'HALF' | 'PENDING' | null}>> = {};

  /** Which teacher cards have their "Not done" panel expanded. Kept
   *  as a Set so any number of cards can be open at once — mirrors
   *  the absentee accordion on View Attendance. */
  private expandedUndone = new Set<string>();

  /** Above this count, the panel collapses behind a Show toggle so a
   *  section with lots of undone students doesn't blow out the card. */
  readonly undoneAccordionThreshold = 8;

  constructor(private api: ApiService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.isTeacherMode = this.auth.currentRole === UserRole.TEACHER;
    this.load();
  }

  /** Called when the admin picks a new date. Refetches from the server
   *  with the new date filter so the payload stays small. */
  onDateChange(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.myStatus = {};
    this.undone = {};
    this.expandedUndone.clear();
    // Teachers get sentByMe=true → "homework I posted on this date".
    // Students/parents send a date range → the last few days of
    // assignments in one shot, so they don't miss earlier work.
    const req$ = this.isTeacherMode
      ? this.api.getHomeworkNotifications(this.formatDate(this.selectedDate), 0, 50, true)
      : this.api.getHomeworkNotificationsRange(
          this.formatDate(this.fromDate),
          this.formatDate(this.toDate),
          0, 50, false);
    req$.subscribe({
      next: (res) => {
        this.homework = (res?.data as any)?.content || [];
        this.isLoading = false;
        // After the list arrives, fetch the batched done/pending map
        // for the student view so each row can show its status chip.
        // Teachers instead get the batched "not done" roster used by
        // the inline accordion on each card.
        if (this.homework.length > 0) {
          if (this.isTeacherMode) this.loadUndone();
          else this.loadMyStatus();
        }
      },
      error: () => {
        this.homework = [];
        this.isLoading = false;
      },
    });
  }

  private loadUndone(): void {
    const ids = this.homework.map((h) => h.notificationId).filter((x) => !!x);
    if (ids.length === 0) return;
    this.api.getHomeworkUndoneBatch(ids).subscribe({
      next: (res) => { this.undone = (res?.data as any) || {}; },
      error: () => { this.undone = {}; },
    });
  }

  /** The "not done" roster for a given homework card. Empty array
   *  when the batched call hasn't returned yet or nobody's undone. */
  undoneOf(h: any): Array<{studentId: string; fullName: string; rollNumber: string | null; status: 'HALF' | 'PENDING' | null}> {
    return this.undone[h?.notificationId] || [];
  }

  /** Compact "Roll · Name" label. Falls back to bare name when a
   *  student has no roll number set. */
  undoneLabel(u: {fullName: string; rollNumber: string | null}): string {
    return u.rollNumber ? `${u.rollNumber} · ${u.fullName}` : u.fullName;
  }

  shouldCollapseUndone(h: any): boolean {
    return this.undoneOf(h).length > this.undoneAccordionThreshold;
  }

  isUndoneExpanded(h: any): boolean {
    return this.expandedUndone.has(h?.notificationId);
  }

  toggleUndone(h: any, event: Event): void {
    event.stopPropagation();
    const id = h?.notificationId;
    if (!id) return;
    if (this.expandedUndone.has(id)) this.expandedUndone.delete(id);
    else this.expandedUndone.add(id);
  }

  private loadMyStatus(): void {
    const ids = this.homework.map((h) => h.notificationId).filter((x) => !!x);
    if (ids.length === 0) return;
    this.api.getMyHomeworkStatusBatchFull(ids).subscribe({
      next: (res) => { this.myStatus = (res?.data as any) || {}; },
      error: () => { this.myStatus = {}; },
    });
  }

  /** The variant of chip to render for a homework row on the student
   *  side. Reminder rows never reach this list (backend filters them
   *  out), so we only handle the four statuses on the original.
   *  - null → "Pending" (default, teacher hasn't touched the entry)
   *  - PENDING → "Not done" (explicit teacher call + reminder fired)
   *  - HALF → "Half done"
   *  - DONE → "Done" */
  chipFor(h: any): 'DONE' | 'HALF' | 'NOT_DONE' | 'PENDING' {
    const s = this.myStatus[h?.notificationId];
    if (s === 'DONE') return 'DONE';
    if (s === 'HALF') return 'HALF';
    if (s === 'PENDING') return 'NOT_DONE';
    return 'PENDING';
  }

  open(h: any): void {
    // Teachers get a full-page Roster view (dedicated route) with
    // tabs + per-student remark + Save & Notify. Students keep the
    // lightweight inline popup for reading.
    if (this.isTeacherMode) {
      if (h?.notificationId) {
        this.router.navigate(['/homework', h.notificationId, 'roster']);
      }
      return;
    }
    this.opened = h;
  }

  close(): void {
    this.opened = null;
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

  /** yyyy-MM-dd in local time — matches what the backend
   *  {@code @DateTimeFormat(iso = ISO.DATE)} parser expects. */
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
