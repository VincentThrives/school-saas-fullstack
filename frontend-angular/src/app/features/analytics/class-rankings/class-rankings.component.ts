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
  examTypes: string[] = [];
  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  sections: { sectionId: string; name: string; subjectIds?: string[] }[] = [];
  subjects: SubjectItem[] = [];

  // Selected filters
  selectedExamTypes: string[] = [];
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

  ngOnInit(): void {
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
    this.selectedExamTypes = [];
    this.selectedSubjectIds = [];
    this.classes = [];
    this.sections = [];
    this.examTypes = [];
    this.subjects = [];
    this.rankings = [];

    if (!this.selectedAcademicYearId) return;

    this.api.getClasses(this.selectedAcademicYearId).subscribe((res) => {
      this.classes = res.data || [];
    });
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedExamTypes = [];
    this.selectedSubjectIds = [];
    this.sections = [];
    this.examTypes = [];
    this.subjects = [];
    this.rankings = [];

    if (!this.selectedClassId) return;

    const selectedClass = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = selectedClass?.sections || [];

    // Populate Exam Type immediately — "All Sections" is the default
    // section state, so the admin can pick an exam type right away
    // without first opening the Section dropdown.
    this.populateExamTypes();
  }

  onSectionChange(): void {
    this.selectedExamTypes = [];
    this.selectedSubjectIds = [];
    this.examTypes = [];
    this.subjects = [];
    this.rankings = [];
    // Re-narrow exam types by the new (class, section) pair.
    this.populateExamTypes();
  }

  /**
   * Compute the Exam Type options from {@link allExams} filtered by the
   * currently-picked Academic Year + Class + (optional) Section. Schools
   * with section-specific exams (rare but happens — half-day grades that
   * skip a paper) will see a narrower list when a section is chosen.
   */
  private populateExamTypes(): void {
    if (!this.selectedAcademicYearId || !this.selectedClassId) {
      this.examTypes = [];
      return;
    }
    const matching = this.allExams.filter((e: any) => {
      if (e.academicYearId !== this.selectedAcademicYearId) return false;
      if (e.classId !== this.selectedClassId) return false;
      // Section filter is permissive: if no section is picked OR the exam
      // wasn't tagged with one, treat it as a match. Avoids hiding exams
      // that were scheduled at the class level rather than per-section.
      if (this.selectedSectionId && e.sectionId && e.sectionId !== this.selectedSectionId) return false;
      return !!e.examType;
    });
    const types = new Set<string>();
    matching.forEach((e: any) => { types.add(e.examType); });
    this.examTypes = Array.from(types).sort();
  }

  onExamTypeChange(): void {
    this.selectedSubjectIds = [];
    this.subjects = [];
    this.rankings = [];

    if (this.selectedExamTypes.length === 0) return;

    // Subjects come from the exams matching every upstream filter, so
    // the list never offers a subject without rank data behind it. This
    // also dodges the earlier bug where section.subjectIds was empty
    // for newly-created classes and the dropdown silently emptied out.
    const matching = this.allExams.filter((e: any) => {
      if (e.academicYearId !== this.selectedAcademicYearId) return false;
      if (e.classId !== this.selectedClassId) return false;
      if (this.selectedSectionId && e.sectionId && e.sectionId !== this.selectedSectionId) return false;
      if (!this.selectedExamTypes.includes(e.examType)) return false;
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
    });
  }

  onSubjectChange(): void {
    this.rankings = [];
    if (this.selectedSubjectIds.length === 0) return;
    this.loadRankings();
  }

  loadRankings(): void {
    // Find matching exams based on all filters
    const matchingExams = this.allExams.filter((e: any) => {
      const typeMatch = this.selectedExamTypes.includes(e.examType);
      const yearMatch = e.academicYearId === this.selectedAcademicYearId;
      const classMatch = e.classId === this.selectedClassId;
      const subjectMatch = this.selectedSubjectIds.includes(e.subjectId);
      // Section is optional — if not selected, match all sections
      const sectionMatch = !this.selectedSectionId || !e.sectionId || e.sectionId === this.selectedSectionId;
      return typeMatch && yearMatch && classMatch && subjectMatch && sectionMatch;
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
