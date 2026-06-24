import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ApiService } from '../../core/services/api.service';

/**
 * Tenant-level configuration page where the school admin decides
 * which sidenav modules the SCHOOL_STAFF role can see and use. Other
 * roles (SCHOOL_ADMIN, PRINCIPAL, TEACHER, STUDENT, PARENT) are
 * unaffected — they always see what their role's normal rules allow.
 *
 * <p>Default for a fresh tenant is full access (every module ticked).
 * Admin unticks specific modules to lock staff out; "Reset to full
 * access" puts everything back on with one click.</p>
 */
@Component({
  selector: 'app-staff-access',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './staff-access.component.html',
  styleUrl: './staff-access.component.scss',
})
export class StaffAccessComponent implements OnInit {
  /** Every module key the catalog offers (drives the row order). */
  catalog: string[] = [];
  /** Currently-enabled module keys — toggled by the checkboxes. */
  enabled = new Set<string>();
  isLoading = false;
  isSaving = false;

  /** Human-readable labels per module key. Lives client-side so the
   *  backend can stay strict (machine keys only) and we still render
   *  "Mark Attendance" instead of "ATTENDANCE" in the UI. */
  readonly labels: Record<string, { title: string; subtitle: string }> = {
    ATTENDANCE:     { title: 'Attendance',       subtitle: 'View Attendance hub, Mark Attendance, Attendance Reports' },
    EXAMS:          { title: 'Exams',            subtitle: 'View exams list, enter / edit marks, exam reports' },
    SMS:            { title: 'SMS',              subtitle: "Today's absence alerts, custom broadcasts, audit log" },
    NOTIFICATIONS:  { title: 'Notifications',    subtitle: 'In-app notification feed' },
    FEES:           { title: 'Fees',             subtitle: 'Student fees, collection, dues' },
    REPORT_CARDS:   { title: 'Report Cards',     subtitle: 'Generate + view report cards' },
    EVENTS:         { title: 'Events',           subtitle: 'Calendar of school events + holidays' },
    TIMETABLE:      { title: 'Timetable',        subtitle: 'View + edit class timetables. ⚠ structural — turn off unless staff needs to edit.' },
    SUBJECTS:       { title: 'Subjects',         subtitle: 'Subject definitions + components. ⚠ structural.' },
    CLASSES:        { title: 'Classes',          subtitle: 'Class + section setup. ⚠ structural.' },
    ACADEMIC_YEARS: { title: 'Academic Years',   subtitle: 'Year setup + transitions. ⚠ structural.' },
    STUDENTS:       { title: 'Students',         subtitle: 'View + edit student records' },
    TEACHERS:       { title: 'Teachers',         subtitle: 'View + edit teacher records' },
  };

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.api.getStaffAccess().subscribe({
      next: (res) => {
        const data = res?.data;
        this.catalog = data?.catalog || [];
        this.enabled = new Set<string>(data?.enabledModules || []);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(err?.error?.message || 'Failed to load staff access', 'Close', { duration: 4000 });
      },
    });
  }

  isEnabled(key: string): boolean { return this.enabled.has(key); }

  toggle(key: string, checked: boolean): void {
    if (checked) this.enabled.add(key);
    else this.enabled.delete(key);
  }

  /** Tick every module — one-click "give staff the full sidenav". */
  enableAll(): void { this.enabled = new Set<string>(this.catalog); }

  /** Untick every module — lock staff down to just the Dashboard. */
  disableAll(): void { this.enabled = new Set<string>(); }

  save(): void {
    this.isSaving = true;
    const payload = this.catalog.filter(k => this.enabled.has(k));
    this.api.updateStaffAccess(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Staff access saved', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save', 'Close', { duration: 4000 });
      },
    });
  }

  label(key: string): string { return this.labels[key]?.title || key; }
  hint(key: string): string { return this.labels[key]?.subtitle || ''; }

  get enabledCount(): number { return this.enabled.size; }
  get totalCount(): number { return this.catalog.length; }
}
