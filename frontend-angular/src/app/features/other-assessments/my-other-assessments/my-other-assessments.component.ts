import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface MyAssessmentRow {
  assessmentId: string;
  name: string;
  type: string | null;
  testDate: string;
  subjects: Array<{ subjectId: string; subjectName: string; maxMarks: number }>;
  myMarks: Array<{ subjectId: string; marksObtained: number | null; remark: string | null }>;
  remark: string | null;
  /** Student's standard rank on this assessment. Null before any
   *  marks have been entered by the admin (rank isn't meaningful
   *  yet — displayed as "—" in the UI). */
  myRank: number | null;
  /** Number of students ranked on this assessment — for the
   *  "Rank 3 of 40" label. */
  rankedCount: number;
}

/**
 * Student / parent view of Other Assessments — one card per assessment
 * the student appears in, showing their own marks per subject plus a
 * running total. Backend strips other students' data so peers'
 * scores are never delivered to the client.
 */
@Component({
  selector: 'app-my-other-assessments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './my-other-assessments.component.html',
  styleUrl: './my-other-assessments.component.scss',
})
export class MyOtherAssessmentsComponent implements OnInit {
  rows: MyAssessmentRow[] = [];
  isLoading = false;

  /** Free-text search across name + type. */
  searchQuery = '';
  /** Type filter — 'all' or one of the types the student's rows use. */
  typeFilter = 'all';

  /** Number of assessments shown per page. */
  readonly PAGE_SIZE = 5;
  /** 1-indexed current page. Resets to 1 on filter change so a
   *  narrower search doesn't strand the student on an empty tail. */
  currentPage = 1;

  /** Row clicked open in the details popup. Null when the popup is
   *  closed. Details render from the same MyAssessmentRow shape the
   *  list uses — no extra fetch. */
  opened: MyAssessmentRow | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.api.getMyOtherAssessments().subscribe({
      next: (res) => {
        this.rows = (res?.data as MyAssessmentRow[]) || [];
        this.isLoading = false;
      },
      error: () => {
        this.rows = [];
        this.isLoading = false;
      },
    });
  }

  /** Distinct types across the student's rows — feeds the Type
   *  filter dropdown so the student sees only labels their school
   *  actually uses ("CET", "Mock", ...). */
  get availableTypes(): string[] {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.type) set.add(r.type);
    }
    return Array.from(set).sort();
  }

  /** Post-filter rows sorted newest first. */
  get filteredRows(): MyAssessmentRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.rows.filter((r) => {
      if (this.typeFilter !== 'all' && (r.type || '') !== this.typeFilter) return false;
      if (q) {
        const hay = (r.name + ' ' + (r.type || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /** Slice actually rendered on the page — driven by {@link currentPage}
   *  and PAGE_SIZE. */
  get visibleRows(): MyAssessmentRow[] {
    const start = (this.currentPage - 1) * this.PAGE_SIZE;
    return this.filteredRows.slice(start, start + this.PAGE_SIZE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.PAGE_SIZE));
  }

  /** 1-indexed first row on the current page — feeds the "1–5 of 12"
   *  label above the pagination controls. */
  get pageStart(): number {
    if (this.filteredRows.length === 0) return 0;
    return (this.currentPage - 1) * this.PAGE_SIZE + 1;
  }

  get pageEnd(): number {
    return Math.min(this.filteredRows.length, this.currentPage * this.PAGE_SIZE);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  /** Reset pagination on filter change so a narrower search doesn't
   *  strand the student on an empty tail page. */
  onFilterChange(): void {
    this.currentPage = 1;
  }

  openDetails(row: MyAssessmentRow): void {
    this.opened = row;
  }

  closeDetails(): void {
    this.opened = null;
  }

  /** Look up the mark row for a given subject on an assessment. */
  markFor(row: MyAssessmentRow, subjectId: string): number | null {
    const m = row.myMarks?.find((x) => x.subjectId === subjectId);
    return m?.marksObtained ?? null;
  }

  totalObtained(row: MyAssessmentRow): number {
    let sum = 0;
    for (const m of (row.myMarks || [])) {
      if (typeof m.marksObtained === 'number') sum += m.marksObtained;
    }
    return sum;
  }

  totalMax(row: MyAssessmentRow): number {
    return (row.subjects || []).reduce((s, x) => s + (x.maxMarks || 0), 0);
  }

  percentage(row: MyAssessmentRow): number {
    const max = this.totalMax(row);
    if (max <= 0) return 0;
    return Math.round((this.totalObtained(row) / max) * 1000) / 10;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined,
        { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
