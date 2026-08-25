import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService, UnboundStudent } from '../../../core/services/api.service';

/**
 * Global "Unbound Students" audit dialog — lists every student in the
 * tenant who doesn't yet have a binding on ANY terminal. Admin opens
 * from the Attendance Terminals page header to see who's truly missing
 * across the whole school (not just on one specific device — that
 * false-positives when different terminals cover different classes).
 */
@Component({
  selector: 'app-unbound-students-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './unbound-students-dialog.component.html',
  styleUrl: './unbound-students-dialog.component.scss',
})
export class UnboundStudentsDialogComponent implements OnInit {
  students: UnboundStudent[] = [];
  isLoading = false;
  loadError = '';
  searchQuery = '';

  constructor(
    private dialogRef: MatDialogRef<UnboundStudentsDialogComponent>,
    private api: ApiService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading = true;
    this.loadError = '';
    this.api.getUnboundStudentsGlobal().subscribe({
      next: (res) => {
        this.students = res?.data || [];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = err?.error?.message || 'Failed to load unbound students';
      },
    });
  }

  /** Live client-side filter — handles name / class / section / roll /
   *  admission number in one haystack lookup. Cheap for the ~500 rows
   *  a single school would ever have. */
  get filtered(): UnboundStudent[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.students;
    return this.students.filter(s => {
      const hay = [
        s.name, s.className, s.sectionName,
        s.rollNumber, s.admissionNumber,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  /** Combined "1st · A" label for the row — nicer than two columns
   *  when class + section are almost always both present. */
  classSection(s: UnboundStudent): string {
    if (s.className && s.sectionName) return s.className + ' · ' + s.sectionName;
    return s.className || s.sectionName || '—';
  }

  close(): void { this.dialogRef.close(); }
}
