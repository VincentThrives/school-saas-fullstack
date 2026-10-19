import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear, ClassRanking } from '../../../core/models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-class-rankings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './class-rankings.component.html',
  styleUrl: './class-rankings.component.scss',
})
export class ClassRankingsComponent implements OnInit {
  // Data sources
  allExams: any[] = [];
  /** Exam name prefixes (FA1, FA2, SA1 …) extracted from exam.name. The
   *  dropdown used to show the raw type ("FA", "SA") which merged every
   *  FA event together — picking "FA" would score FA1 + FA2 as one bucket.
   *  Prefix-level grouping lets the admin rank a specific FA1 alone. */
  examNames: string[] = [];
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  sections: { sectionId: string; name: string; subjectIds?: string[] }[] = [];
  subjects: SubjectItem[] = [];

  // Selected filters
  /** Picked exam names (e.g. ["FA1"], or ["FA1","FA2"] to aggregate). */
  selectedExamNames: string[] = [];
  selectedAcademicYearId = '';
  selectedClassId = '';
  selectedSectionId = '';
  selectedSubjectIds: string[] = [];

  // Rankings
  rankings: ClassRanking[] = [];
  displayedColumns = ['rank', 'studentName', 'rollNumber', 'classSection', 'totalMarks', 'percentage'];
  isLoading = false;

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
  ) {}

  /** Color band for the percentage mini-bar — same palette as the
   *  Report Card view's score bar so the brand reads consistent. */
  pctColor(pct: number): string {
    const p = pct || 0;
    if (p >= 85) return '#22c55e';     // A+/A — green
    if (p >= 70) return '#3b82f6';     // B+/B — blue
    if (p >= 55) return '#f59e0b';     // C    — amber
    if (p >= 35) return '#f97316';     // D    — orange
    return '#ef4444';                   // F    — red
  }

  ngOnInit(): void {
    // Read the Publish workflow setting first — determines whether the
    // Exam dropdown decorates Draft-only names with a tag and whether
    // selecting one shows the "Not Published" empty state. Default off
    // → every exam is treated as publishable, no decoration.
    this.api.getSettings().subscribe({
      next: (res) => {
        this.publishWorkflowEnabled = !!(res?.data as any)?.examPublishWorkflowEnabled;
        // Recompute if names were already derived under the default-off
        // assumption, now that we know the real setting.
        if (this.selectedClassId) this.populateExamNames();
      },
    });

    // forkJoin both lookups so we can default the AY to "current" only
    // ONCE both arrived. Previously these subscribed separately and the
    // page sat with empty Exam Type / Class / Section / Subjects
    // dropdowns until the admin manually opened the Academic Year
    // picker — the AY default + cascade was never wired up.
    forkJoin({
      exams: this.api.getExams(),
      years: this.api.getAcademicYears(),
    }).subscribe({
      next: ({ exams, years }) => {
        this.allExams = exams.data || [];
        this.academicYears = years.data || [];
        const current = this.academicYears.find((ay) => ay.current);
        if (current) {
          this.selectedAcademicYearId = current.academicYearId;
          // Populate Exam Type from the chosen year and reset
          // downstream filters — mirrors what the dropdown handler
          // would do when the user picks a year manually.
          this.onAcademicYearChange();
        }
      },
    });
  }

  // ── Cascade order: AY → Class → Section → Exam Type → Subjects ──
  //
  // Earlier the cascade went AY → Exam Type → Class → Section → Subjects,
  // which forced the admin to pick "Unit Test 1" before they knew which
  // class even ran one. The new order matches how a principal actually
  // thinks: pick a class first, then narrow to a section, then ask which
  // exam type to compare. Subjects come from the matching exams so the
  // dropdown only ever shows things that actually have rank data.

  onAcademicYearChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedExamNames = [];
    this.selectedSubjectIds = [];
    this.classes = [];
    this.sections = [];
    this.examNames = [];
    this.subjects = [];
    this.rankings = [];

    if (!this.selectedAcademicYearId) return;

    this.api.getClasses(this.selectedAcademicYearId).subscribe((res) => {
      this.classes = res.data || [];
      // Auto-select the first class so the admin lands on usable data
      // on first visit. Section → Exam → Subjects then cascade.
      if (this.classes.length > 0) {
        this.selectedClassId = this.classes[0].classId;
        this.onClassChange();
      }
    });
  }

  /** True until the first cascade completes — the only moment we're
   *  allowed to pick a default Exam / Subject for the admin. Later
   *  class/section changes keep whatever the admin picked, as long as
   *  it's still a valid option for the new scope. */
  private isFirstLoad = true;

  onClassChange(): void {
    const prevExam = this.selectedExamNames[0];
    this.selectedSectionId = '';
    this.selectedExamNames = [];
    this.selectedSubjectIds = [];
    this.sections = [];
    this.examNames = [];
    this.subjects = [];
    this.rankings = [];

    if (!this.selectedClassId) return;

    const selectedClass = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = selectedClass?.sections || [];

    // Auto-select first section so the cascade continues without a click.
    // Falls back to "All Sections" (empty) if the class has no sections.
    if (this.sections.length > 0) {
      this.selectedSectionId = this.sections[0].sectionId;
    }
    this.populateExamNames();
    this.resolveExamAfterScopeChange(prevExam);
  }

  onSectionChange(): void {
    const prevExam = this.selectedExamNames[0];
    this.selectedExamNames = [];
    this.selectedSubjectIds = [];
    this.examNames = [];
    this.subjects = [];
    this.rankings = [];
    this.populateExamNames();
    this.resolveExamAfterScopeChange(prevExam);
  }

  /**
   * Called after Class / Section changes repopulate the Exam list.
   *
   * - On the very first page load, auto-pick the first exam so the admin
   *   lands on a populated ranking table.
   * - On any later manual change, PRESERVE the admin's previously-chosen
   *   exam if it's still a valid option (same name exists in the new
   *   scope — e.g. FA2 exists in both 10-B and 10-C). Otherwise the
   *   dropdown clears so the admin picks fresh — we don't auto-swap
   *   silently to a different exam.
   */
  private resolveExamAfterScopeChange(prevExam: string | undefined): void {
    if (this.examNames.length === 0) return;
    if (this.isFirstLoad) {
      this.isFirstLoad = false;
      // Prefer the first PUBLISHED name on first load so the rankings
      // table lands populated. Falls back to the first available name
      // (including Drafts) when nothing is published yet — the UI will
      // show the "Not Published" empty state.
      const firstPublished = this.examNames.find(n => !this.draftOnlyExamNames.has(n));
      this.selectedExamNames = [firstPublished || this.examNames[0]];
      this.onExamNameChange();
      return;
    }
    if (prevExam && this.examNames.includes(prevExam)) {
      this.selectedExamNames = [prevExam];
      this.onExamNameChange();
    }
  }

  /**
   * Strip the subject suffix ("· Kannada", "— Math", "- Physics") from an
   * exam.name so sibling-subject rows collapse into the same event name
   * (e.g. "FA1 · Kannada" and "FA1 · Math" both become "FA1"). Mirrors the
   * backend's examNamePrefix() helper so the admin sees the same labels
   * the rollout + Exam Config pages show. Falls back to examType when
   * the exam has no name (legacy / imported rows).
   */
  private examNamePrefix(e: any): string {
    const name = (e?.name || '').toString();
    if (name) {
      const seps = [' · ', ' — ', ' - '];
      let bestIdx = -1;
      for (const sep of seps) {
        const idx = name.indexOf(sep);
        if (idx > 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
      }
      return (bestIdx > 0 ? name.substring(0, bestIdx) : name).trim();
    }
    return (e?.examType || '').toString();
  }

  /**
   * Compute the Exam options from {@link allExams} filtered by the
   * currently-picked Academic Year + Class + (optional) Section. Schools
   * with section-specific exams (rare but happens — half-day grades that
   * skip a paper) will see a narrower list when a section is chosen.
   */
  /** Names in the dropdown that have ZERO published exams in the current
   *  scope. Rendered with a "Draft" tag so admins see "yes FA2 exists
   *  but it isn't published yet" instead of silently missing from the
   *  list and wondering where it went. Only populated when the school
   *  opted in to the Publish workflow. */
  draftOnlyExamNames = new Set<string>();
  /** True when the school opted in to the Publish gate in Settings →
   *  Exams. Off by default. */
  publishWorkflowEnabled = false;

  private populateExamNames(): void {
    if (!this.selectedAcademicYearId || !this.selectedClassId) {
      this.examNames = [];
      this.draftOnlyExamNames = new Set();
      return;
    }
    // Match ALL exams in scope (published OR draft) so unpublished names
    // still appear in the dropdown — hiding them silently confused admins
    // who wondered why an exam they just created wasn't selectable.
    const matching = this.allExams.filter((e: any) => {
      if (e.academicYearId !== this.selectedAcademicYearId) return false;
      if (e.classId !== this.selectedClassId) return false;
      if (this.selectedSectionId && e.sectionId && e.sectionId !== this.selectedSectionId) return false;
      return !!this.examNamePrefix(e);
    });
    const publishedNames = new Set<string>();
    const allNames = new Set<string>();
    matching.forEach((e: any) => {
      const n = this.examNamePrefix(e);
      allNames.add(n);
      if (e.published) publishedNames.add(n);
    });
    // Draft-only = name exists but no exam under that name is published.
    // Suppress when the school hasn't opted in to the Publish gate —
    // every exam is treated as publishable in that mode so the tag
    // would be noise.
    this.draftOnlyExamNames = this.publishWorkflowEnabled
      ? new Set(Array.from(allNames).filter(n => !publishedNames.has(n)))
      : new Set();
    this.examNames = Array.from(allNames).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  /** True when every exam under this name in the current scope is a Draft. */
  isExamNameDraftOnly(name: string): boolean {
    return this.draftOnlyExamNames.has(name);
  }

  /** True when the admin picked an exam whose data is all Draft — the
   *  rankings table shows a "not published" empty state instead of
   *  silently nothing. */
  get selectedIsDraftOnly(): boolean {
    return this.selectedExamNames.length > 0
      && this.selectedExamNames.every(n => this.draftOnlyExamNames.has(n));
  }

  onExamNameChange(): void {
    const prevSubjectIds = [...this.selectedSubjectIds];
    this.selectedSubjectIds = [];
    this.subjects = [];
    this.rankings = [];

    if (this.selectedExamNames.length === 0) return;

    // Subjects come from the exams matching every upstream filter, so
    // the list never offers a subject without rank data behind it. This
    // also dodges the earlier bug where section.subjectIds was empty
    // for newly-created classes and the dropdown silently emptied out.
    const matching = this.allExams.filter((e: any) => {
      if (e.academicYearId !== this.selectedAcademicYearId) return false;
      if (e.classId !== this.selectedClassId) return false;
      if (this.selectedSectionId && e.sectionId && e.sectionId !== this.selectedSectionId) return false;
      if (!this.selectedExamNames.includes(this.examNamePrefix(e))) return false;
      return !!e.subjectId;
    });
    const subjectIds = new Set<string>();
    matching.forEach((e: any) => { subjectIds.add(e.subjectId); });
    const ids = Array.from(subjectIds);
    if (ids.length === 0) {
      this.subjects = [];
      return;
    }
    this.subjectService.getSubjectsByIds(ids).subscribe((subjects: SubjectItem[]) => {
      this.subjects = subjects;
      if (this.subjects.length === 0) return;
      // Preserve the admin's previous subject picks that are still
      // valid for the new exam scope — switching 10-B → 10-C with
      // "Kannada" selected should keep Kannada if 10-C also has it.
      // Only on the very first page load do we auto-pick the first
      // subject so the table lands populated.
      const stillValid = prevSubjectIds.filter(id =>
        this.subjects.some(s => s.subjectId === id));
      if (stillValid.length > 0) {
        this.selectedSubjectIds = stillValid;
        this.onSubjectChange();
      } else if (prevSubjectIds.length === 0) {
        // No prior selection → fresh first-time cascade. Pick first.
        this.selectedSubjectIds = [this.subjects[0].subjectId];
        this.onSubjectChange();
      }
      // Otherwise (admin had subjects selected but none survive the
      // scope change) we leave the picker empty so they consciously
      // choose fresh — matches the Exam preservation rule above.
    });
  }

  onSubjectChange(): void {
    this.rankings = [];
    if (this.selectedSubjectIds.length === 0) return;
    this.loadRankings();
  }

  loadRankings(): void {
    // Find matching exams based on all filters. Exam filter is now by
    // name prefix (FA1, SA2 …) rather than the broad type (FA, SA) so
    // picking "FA1" only aggregates FA1 subject rows, not everything
    // the school ever labelled FA.
    const matchingExams = this.allExams.filter((e: any) => {
      // Published gate — only honor when the school opted in to the
      // Publish workflow. With the setting off (default) every exam
      // contributes immediately, matching pre-publish behavior.
      if (this.publishWorkflowEnabled && !e.published) return false;
      const nameMatch = this.selectedExamNames.includes(this.examNamePrefix(e));
      const yearMatch = e.academicYearId === this.selectedAcademicYearId;
      const classMatch = e.classId === this.selectedClassId;
      const subjectMatch = this.selectedSubjectIds.includes(e.subjectId);
      // Section is optional — if not selected, match all sections
      const sectionMatch = !this.selectedSectionId || !e.sectionId || e.sectionId === this.selectedSectionId;
      return nameMatch && yearMatch && classMatch && subjectMatch && sectionMatch;
    });

    if (matchingExams.length === 0) {
      this.rankings = [];
      return;
    }

    this.isLoading = true;

    // Fetch rankings for each matching exam
    const rankingCalls = matchingExams.map(exam => {
      const examId = exam.examId || exam.id;
      return this.api.getClassRankings(this.selectedClassId, examId);
    });

    forkJoin(rankingCalls).subscribe({
      next: (results) => {
        // Aggregate marks across all exams per student
        const studentMap = new Map<string, {
          studentId: string;
          studentName: string;
          rollNumber: string;
          obtainedMarks: number;
          totalMarks: number;
        }>();

        results.forEach(res => {
          const rankings = res.data || [];
          rankings.forEach((r: ClassRanking) => {
            const existing = studentMap.get(r.studentId);
            if (existing) {
              existing.obtainedMarks += r.obtainedMarks;
              existing.totalMarks += r.totalMarks;
            } else {
              studentMap.set(r.studentId, {
                studentId: r.studentId,
                studentName: r.studentName,
                rollNumber: r.rollNumber || '',
                obtainedMarks: r.obtainedMarks,
                totalMarks: r.totalMarks,
              });
            }
          });
        });

        // Compute percentage and sort descending
        const aggregated: ClassRanking[] = Array.from(studentMap.values()).map(s => ({
          ...s,
          maxMarks: s.totalMarks,
          percentage: s.totalMarks > 0 ? Math.round((s.obtainedMarks / s.totalMarks) * 10000) / 100 : 0,
          rank: 0,
        }));

        aggregated.sort((a, b) => b.percentage - a.percentage);
        // Standard competition ranking ("1224"): students with identical
        // percentages share the same rank; the next rank skips the tied
        // positions. Two students at 75% both get rank 1; the next student
        // gets rank 3 (rank 2 is skipped). Epsilon comparison guards against
        // floating-point splitting a real tie.
        if (aggregated.length > 0) {
          aggregated[0].rank = 1;
          for (let i = 1; i < aggregated.length; i++) {
            const prev = aggregated[i - 1];
            const curr = aggregated[i];
            curr.rank = Math.abs(curr.percentage - prev.percentage) < 0.0001
              ? prev.rank
              : i + 1;
          }
        }

        this.rankings = aggregated;
        this.isLoading = false;
      },
      error: () => {
        this.rankings = [];
        this.isLoading = false;
      },
    });
  }

  getClassSectionName(): string {
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    const className = cls?.name || '-';
    if (this.selectedSectionId) {
      const sec = this.sections.find(s => s.sectionId === this.selectedSectionId);
      return className + ' - ' + (sec?.name || '');
    }
    return className + ' (All Sections)';
  }

  getMedalIcon(rank: number): string {
    switch (rank) {
      case 1: return 'emoji_events';
      case 2: return 'military_tech';
      case 3: return 'workspace_premium';
      default: return '';
    }
  }

  getMedalClass(rank: number): string {
    switch (rank) {
      case 1: return 'gold-medal';
      case 2: return 'silver-medal';
      case 3: return 'bronze-medal';
      default: return '';
    }
  }
}
