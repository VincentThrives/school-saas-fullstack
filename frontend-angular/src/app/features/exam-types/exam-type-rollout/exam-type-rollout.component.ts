import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass } from '../../../core/models';

interface SlotStatus {
  slotKey: string;
  slotLabel: string;
  created: number;
  totalExpected: number;
}

interface SchemeSummary {
  id: string;
  name: string;
  description?: string;
  academicYearId?: string;
  applicableClassIds?: string[];
  slots: Array<{ key: string; label: string; kind: string; rawMax: number; weightMax: number }>;
}

@Component({
  selector: 'app-exam-type-rollout',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatTooltipModule, MatProgressSpinnerModule, MatChipsModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './exam-type-rollout.component.html',
  styleUrl: './exam-type-rollout.component.scss',
})
export class ExamTypeRolloutComponent implements OnInit {
  schemeId!: string;
  scheme: SchemeSummary | null = null;
  statusBySlot: Record<string, SlotStatus> = {};
  isLoading = false;
  rollingSlotKey: string | null = null;

  // Prompt dialog state — opens when admin clicks "Create exams" and lets
  // them tweak the exam name (default = slot label) before the request fires.
  promptOpen = false;
  promptSlotKey: string | null = null;
  promptSlotLabel = '';
  promptExamName = '';
  promptIsExisting = false;    // true when some exams already exist for this slot

  // Classes in the scheme's academic year — resolved so chips show names and
  // we can show the (classes × sections) breakdown of the expected count.
  classesInYear: SchoolClass[] = [];
  classNameById: Record<string, string> = {};
  totalSectionCount = 0;         // sum of sections across applicable classes
  avgSubjectsPerSection = 0;     // informational — "25 = 5 classes × 1 section × ~5 subjects"

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/exam-types']);
      return;
    }
    this.schemeId = id;
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading = true;
    // We don't have a single-scheme-by-id endpoint — pull from the list and
    // find the match. Cheap enough with the current data volumes and avoids
    // adding a new endpoint just for this page.
    forkJoin({
      list: this.api.getExamSchemes(true),
      status: this.api.getExamSchemeRolloutStatus(this.schemeId),
    }).subscribe({
      next: ({ list, status }) => {
        const rows: any[] = Array.isArray((list as any)?.data) ? (list as any).data : [];
        const row = rows.find(r => r.id === this.schemeId);
        if (!row) {
          this.snackBar.open('Scheme not found', 'Close', { duration: 3000 });
          this.router.navigate(['/exam-types']);
          return;
        }
        this.scheme = {
          id: row.id,
          name: row.name,
          description: row.description,
          academicYearId: row.academicYearId,
          applicableClassIds: Array.isArray(row.applicableClassIds) ? row.applicableClassIds : [],
          slots: Array.isArray(row.slots) ? row.slots.map((s: any) => ({
            key: s.key, label: s.label, kind: s.kind,
            rawMax: Number(s.rawMax) || 0, weightMax: Number(s.weightMax) || 0,
          })) : [],
        };
        this.statusBySlot = {};
        for (const st of ((status as any)?.data || [])) {
          this.statusBySlot[st.slotKey] = st;
        }
        // Resolve class names for the UI once we know the scheme's year.
        if (this.scheme.academicYearId) {
          this.loadClassesForYear(this.scheme.academicYearId);
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load scheme rollout', 'Close', { duration: 3000 });
      },
    });
  }

  private loadClassesForYear(yearId: string): void {
    this.api.getClasses(yearId).subscribe({
      next: (res: any) => {
        this.classesInYear = Array.isArray(res?.data) ? res.data : [];
        this.classNameById = {};
        for (const c of this.classesInYear) this.classNameById[c.classId] = c.name;
        this.computeBreakdown();
        this.isLoading = false;
      },
      error: () => this.isLoading = false,
    });
  }

  /** Count sections + estimate subjects/section across the scheme's classes. */
  private computeBreakdown(): void {
    if (!this.scheme) { this.totalSectionCount = 0; this.avgSubjectsPerSection = 0; return; }
    const applicable = this.scheme.applicableClassIds?.length
      ? this.classesInYear.filter(c => this.scheme!.applicableClassIds!.includes(c.classId))
      : this.classesInYear;
    let sections = 0;
    let subjectRefs = 0;   // total subject attachments across all sections
    for (const c of applicable) {
      const secs = c.sections || [];
      sections += secs.length;
      for (const s of secs) subjectRefs += (s.subjectIds || []).length;
    }
    this.totalSectionCount = sections;
    this.avgSubjectsPerSection = sections > 0 ? Math.round(subjectRefs / sections) : 0;
  }

  /** Class name for a chip — falls back to the raw id while classes load. */
  classChipLabel(id: string): string {
    return this.classNameById[id] || id;
  }

  get applicableClassCount(): number {
    if (!this.scheme) return 0;
    return this.scheme.applicableClassIds?.length
      ? this.scheme.applicableClassIds.length
      : this.classesInYear.length;
  }

  statusFor(slotKey: string): SlotStatus {
    return this.statusBySlot[slotKey]
      || { slotKey, slotLabel: slotKey, created: 0, totalExpected: 0 };
  }

  /** Opens the "Confirm exam name" prompt before firing the rollout. */
  openRolloutPrompt(slotKey: string, slotLabel: string): void {
    const status = this.statusFor(slotKey);
    this.promptSlotKey = slotKey;
    this.promptSlotLabel = slotLabel;
    this.promptExamName = slotLabel;  // Default: the slot's own label (FA1, SA1, …)
    this.promptIsExisting = status.created > 0;
    this.promptOpen = true;
  }

  closeRolloutPrompt(): void {
    if (this.rollingSlotKey) return;
    this.promptOpen = false;
    this.promptSlotKey = null;
    this.promptSlotLabel = '';
    this.promptExamName = '';
  }

  confirmRollout(): void {
    const slotKey = this.promptSlotKey;
    const slotLabel = this.promptSlotLabel;
    const examName = (this.promptExamName || '').trim();
    if (!slotKey) return;
    if (!examName) {
      this.snackBar.open('Exam name is required', 'Close', { duration: 2500 });
      return;
    }
    this.rollingSlotKey = slotKey;
    this.api.rolloutExamSchemeSlot(this.schemeId, slotKey, examName).subscribe({
      next: (res) => {
        this.rollingSlotKey = null;
        this.promptOpen = false;
        const r = (res as any)?.data || {};
        const created = r.created ?? 0;
        const skipped = r.skippedExisting ?? 0;
        const skippedNoSub = r.skippedNoSubjects ?? 0;
        let msg = `${slotLabel} ("${examName}"): created ${created} exam${created === 1 ? '' : 's'}`;
        if (skipped > 0) msg += ` · ${skipped} skipped (already existed)`;
        if (skippedNoSub > 0) msg += ` · ${skippedNoSub} class(es) have no subjects`;
        this.snackBar.open(msg, 'Close', { duration: 5000 });
        this.api.getExamSchemeRolloutStatus(this.schemeId).subscribe({
          next: (res2) => {
            this.statusBySlot = {};
            for (const st of ((res2 as any)?.data || [])) this.statusBySlot[st.slotKey] = st;
          },
        });
      },
      error: (err) => {
        this.rollingSlotKey = null;
        this.snackBar.open(err?.error?.message || `Failed to roll out ${slotLabel}`, 'Close', { duration: 5000 });
      },
    });
  }

  cancel(): void { this.router.navigate(['/exam-types']); }

  kindColor(kind: string): string {
    switch (kind) {
      case 'SA': return '#7c3aed';
      case 'OTHER': return '#6b7280';
      default: return '#0369a1';  // FA
    }
  }
}
