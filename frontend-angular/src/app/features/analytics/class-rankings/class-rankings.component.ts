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
    this.api.getExams().subscribe((res) => {
      this.allExams = res.data || [];
    });

    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
    });
  }

  onAcademicYearChange(): void {
    this.selectedExamTypes = [];
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedSubjectIds = [];
    this.classes = [];
    this.sections = [];
    this.subjects = [];
    this.rankings = [];

    if (!this.selectedAcademicYearId) {
      this.examTypes = [];
      return;
    }

    const examsForYear = this.allExams.filter((e: any) => e.academicYearId === this.selectedAcademicYearId);
    const types = new Set<string>();
    examsForYear.forEach((e: any) => {
      if (e.examType) types.add(e.examType);
    });
    this.examTypes = Array.from(types).sort();
  }

  onExamTypeChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedSubjectIds = [];
    this.sections = [];
    this.subjects = [];
    this.rankings = [];

    if (this.selectedExamTypes.length === 0) {
      this.classes = [];
      return;
    }

    this.api.getClasses(this.selectedAcademicYearId).subscribe((res) => {
      this.classes = res.data || [];
    });
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedSubjectIds = [];
    this.rankings = [];

    if (!this.selectedClassId) {
      this.sections = [];
      this.subjects = [];
      return;
    }

    const selectedClass = this.classes.find(c => c.classId === this.selectedClassId);
    this.sections = selectedClass?.sections || [];

    // Load subjects from ALL sections of this class
    this.loadSubjectsForClass();
  }

  onSectionChange(): void {
    this.rankings = [];

    const loadAndRerank = (subjects: SubjectItem[]) => {
      this.subjects = subjects;
      // Keep only previously selected subjects that are still valid
      const validIds = subjects.map(s => s.subjectId);
      this.selectedSubjectIds = this.selectedSubjectIds.filter(id => validIds.includes(id));
      // Auto-load rankings if subjects are still selected
      if (this.selectedSubjectIds.length > 0) {
        this.loadRankings();
      }
    };

    if (this.selectedSectionId) {
      const selectedSection = this.sections.find(s => s.sectionId === this.selectedSectionId);
      const subjectIds = selectedSection?.subjectIds || [];
      if (subjectIds.length > 0) {
        this.subjectService.getSubjectsByIds(subjectIds).subscribe(loadAndRerank);
      } else {
        this.subjects = [];
        this.selectedSubjectIds = [];
      }
    } else {
      // No section selected — load subjects from all sections
      const allSubjectIds = new Set<string>();
      this.sections.forEach(sec => {
        (sec.subjectIds || []).forEach(id => allSubjectIds.add(id));
      });
      const ids = Array.from(allSubjectIds);
      if (ids.length > 0) {
        this.subjectService.getSubjectsByIds(ids).subscribe(loadAndRerank);
      } else {
        this.subjects = [];
        this.selectedSubjectIds = [];
      }
    }
  }

  private loadSubjectsForClass(): void {
    // Merge subjectIds from all sections of the selected class
    const allSubjectIds = new Set<string>();
    this.sections.forEach(sec => {
      (sec.subjectIds || []).forEach(id => allSubjectIds.add(id));
    });

    const ids = Array.from(allSubjectIds);
    if (ids.length > 0) {
      this.subjectService.getSubjectsByIds(ids).subscribe((subjects) => {
        this.subjects = subjects;
      });
    } else {
      this.subjects = [];
    }
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
        aggregated.forEach((r, i) => r.rank = i + 1);

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
