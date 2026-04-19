import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SubjectService } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear, UserRole, Teacher, CreateSyllabusRequest, TeacherSubjectAssignment } from '../../../core/models';

interface TopicRow {
  topicId?: string;
  topicName: string;
  description: string;
  plannedDate: string;
}

@Component({
  selector: 'app-syllabus-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './syllabus-form.component.html',
  styleUrl: './syllabus-form.component.scss',
})
export class SyllabusFormComponent implements OnInit {
  isEdit = false;
  syllabusId = '';

  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];

  selectedAcademicYearId = '';
  selectedClassId = '';
  selectedSectionId = '';
  selectedSubjectId = '';

  topics: TopicRow[] = [{ topicName: '', description: '', plannedDate: '' }];

  isLoading = false;
  isSaving = false;

  isTeacher = false;
  myTeacher: Teacher | null = null;
  myAssignments: TeacherSubjectAssignment[] = [];

  // Precomputed option arrays
  classOptions: SchoolClass[] = [];
  sectionOptions: { sectionId: string; name: string }[] = [];
  subjectOptions: { id: string; name: string }[] = [];

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.isTeacher = this.authService.hasRole(UserRole.TEACHER)
                  && !this.authService.hasRole(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL);
    this.subjectService.loadSubjects();

    this.api.getClasses().subscribe({
      next: (res) => { this.classes = res.data || []; this.recomputeClassOptions(); },
      error: () => { this.classes = []; this.classOptions = []; },
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) this.selectedAcademicYearId = current.academicYearId;
      this.recomputeClassOptions();
    });

    if (this.isTeacher) {
      this.api.getMyTeacherProfile().subscribe({
        next: (t) => {
          this.myTeacher = t?.data || null;
          this.recomputeClassOptions();
          this.recomputeSectionOptions();
          this.recomputeSubjectOptions();
        },
      });
      this.api.getMyTeacherAssignments().subscribe({
        next: (res) => {
          this.myAssignments = res?.data || [];
          this.recomputeClassOptions();
          this.recomputeSectionOptions();
          this.recomputeSubjectOptions();
        },
      });
    }

    const id = this.route.snapshot.paramMap.get('syllabusId');
    if (id) {
      this.isEdit = true;
      this.syllabusId = id;
      this.loadSyllabus(id);
    }
  }

  /** Union view of the new assignment collection + the legacy inline field,
   *  normalized to { classId, sectionId, subjectId } for the narrowing logic. */
  private get effectiveAssignments(): { classId: string; sectionId?: string; subjectId: string }[] {
    const out: { classId: string; sectionId?: string; subjectId: string }[] = [];
    for (const a of this.myAssignments || []) {
      if (a.status === 'ARCHIVED') continue;
      if (!a.classId || !a.subjectId) continue;
      out.push({ classId: a.classId, sectionId: a.sectionId, subjectId: a.subjectId });
    }
    const legacy = (this.myTeacher?.classSubjectAssignments || []) as any[];
    for (const a of legacy) {
      if (!a.classId || !a.subjectId) continue;
      out.push({ classId: a.classId, sectionId: a.sectionId, subjectId: a.subjectId });
    }
    return out;
  }

  // ── Cascading options (precomputed, NOT getters) ────────────────────

  private recomputeClassOptions(): void {
    let list = this.classes;
    if (this.selectedAcademicYearId) {
      const narrowed = list.filter(c => (c as any).academicYearId === this.selectedAcademicYearId);
      if (narrowed.length > 0) list = narrowed;
    }
    if (this.isTeacher) {
      const allowed = new Set(this.effectiveAssignments.map(a => a.classId));
      if (allowed.size > 0) list = list.filter(c => allowed.has(c.classId));
    }
    this.classOptions = list;
  }

  private recomputeSectionOptions(): void {
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    if (!cls || !cls.sections) { this.sectionOptions = []; return; }
    let list: any[] = cls.sections.map(s => ({ sectionId: (s as any).sectionId, name: (s as any).name }));
    if (this.isTeacher) {
      const mine = this.effectiveAssignments.filter(a => a.classId === this.selectedClassId);
      const hasWildcard = mine.some(a => !a.sectionId);
      const secIds = new Set(mine.map(a => a.sectionId).filter(Boolean) as string[]);
      if (!hasWildcard && secIds.size > 0) {
        list = list.filter(s => secIds.has(s.sectionId));
      }
    }
    this.sectionOptions = list;
  }

  /** Subjects only resolve once a specific Section has been selected. */
  private recomputeSubjectOptions(): void {
    if (!this.selectedClassId || !this.selectedSectionId) { this.subjectOptions = []; return; }
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    if (!cls) { this.subjectOptions = []; return; }
    const section = (cls.sections || []).find(sec => (sec as any).sectionId === this.selectedSectionId);
    if (!section) { this.subjectOptions = []; return; }

    const ids = new Set<string>((section as any).subjectIds || []);
    let all = Array.from(ids).map(id => ({ id, name: this.subjectService.getSubjectName(id) }));
    if (this.isTeacher) {
      const allowed = new Set(
        this.effectiveAssignments
          .filter(a => a.classId === this.selectedClassId
            && (!a.sectionId || a.sectionId === this.selectedSectionId))
          .map(a => a.subjectId));
      if (allowed.size > 0) all = all.filter(s => allowed.has(s.id));
    }
    this.subjectOptions = all;
  }

  // ── Handlers ───────────────────────────────────────────────────────

  onYearChange(): void {
    this.selectedClassId = '';
    this.selectedSectionId = '';
    this.selectedSubjectId = '';
    this.recomputeClassOptions();
    this.sectionOptions = [];
    this.subjectOptions = [];
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedSubjectId = '';
    this.recomputeSectionOptions();
    this.recomputeSubjectOptions();
  }

  onSectionChange(): void {
    this.selectedSubjectId = '';
    this.recomputeSubjectOptions();
  }

  // ── Load for edit ───────────────────────────────────────────────────

  loadSyllabus(id: string): void {
    this.isLoading = true;
    this.api.getSyllabusById(id).subscribe({
      next: (res) => {
        const s = res.data;
        this.selectedAcademicYearId = s.academicYearId;
        this.selectedClassId = s.classId;
        this.selectedSectionId = s.sectionId || '';
        this.selectedSubjectId = s.subjectId;
        this.topics = (s.topics || []).map((t) => ({
          topicId: t.topicId,
          topicName: t.topicName,
          description: t.description || '',
          plannedDate: t.plannedDate || '',
        }));
        if (this.topics.length === 0) this.addTopic();
        this.recomputeClassOptions();
        this.recomputeSectionOptions();
        this.recomputeSubjectOptions();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  // ── Topics list ─────────────────────────────────────────────────────

  addTopic(): void {
    this.topics.push({ topicName: '', description: '', plannedDate: '' });
  }

  removeTopic(index: number): void {
    if (this.topics.length > 1) this.topics.splice(index, 1);
  }

  // ── Save ────────────────────────────────────────────────────────────

  private formatDate(v: any): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch { return ''; }
  }

  save(): void {
    const validTopics = this.topics
      .filter((t) => t.topicName && t.topicName.trim())
      .map(t => ({
        topicId: t.topicId,
        topicName: t.topicName.trim(),
        description: t.description?.trim() || undefined,
        plannedDate: this.formatDate(t.plannedDate) || undefined,
      }));

    if (!this.selectedClassId || !this.selectedSectionId || !this.selectedSubjectId
        || !this.selectedAcademicYearId || validTopics.length === 0) {
      this.snackBar.open('Please select academic year, class, section, subject and add at least one topic.',
        'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const req: CreateSyllabusRequest = {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId,
      subjectId: this.selectedSubjectId,
      subjectName: this.subjectService.getSubjectName(this.selectedSubjectId),
      academicYearId: this.selectedAcademicYearId,
      topics: validTopics,
    };

    const obs = this.isEdit
      ? this.api.updateSyllabus(this.syllabusId, req)
      : this.api.createSyllabus(req);

    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open(this.isEdit ? 'Syllabus updated' : 'Syllabus created', 'Close', { duration: 2500 });
        this.router.navigate(['/syllabus']);
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save syllabus', 'Close', { duration: 3500 });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/syllabus']);
  }
}
