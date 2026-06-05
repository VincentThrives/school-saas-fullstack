import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService, SubjectItem, SubjectComponent } from '../../../core/services/subject.service';
import { environment } from '../../../../environments/environment';
import { AcademicYear, SchoolClass } from '../../../core/models';

/**
 * Mark sheet for INTERNAL-mode component marks.
 *
 * <p>Used for components whose {@code assessmentMode} is INTERNAL —
 * e.g. 10th English's 20-mark Internal Assessment, Computer Science
 * Project portion, etc. These don't go through Exam records; the
 * teacher enters one number per student at the end of each period
 * (term or year, per the component's schedule).
 */
@Component({
  selector: 'app-internal-marks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './internal-marks.component.html',
  styleUrl: './internal-marks.component.scss',
})
export class InternalMarksComponent implements OnInit {
  private readonly API = environment.apiUrl;

  academicYears: AcademicYear[] = [];
  classes: SchoolClass[] = [];
  subjects: SubjectItem[] = [];
  terms: Array<{ id: string; label: string }> = [];

  selectedYearId = '';
  selectedClassId = '';
  selectedSubjectId = '';
  selectedComponentKey = '';
  selectedTermId = '';

  /** INTERNAL-mode components on the chosen subject. */
  internalComponents: SubjectComponent[] = [];

  /** Selected component (cached for schedule / max marks display). */
  selectedComponent: SubjectComponent | null = null;

  students: Array<{ studentId: string; name: string; marksObtained: number | null; remarks: string }> = [];

  isLoading = false;
  isSaving = false;

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getAcademicYears().subscribe(r => {
      this.academicYears = (r as any)?.data ?? [];
      // Auto-pick the current year if there is one.
      const current = this.academicYears.find((y: any) => y.isCurrent);
      if (current) {
        this.selectedYearId = current.academicYearId;
        this.onYearChange();
      }
    });
  }

  // ── Cascade: year -> classes ──────────────────────────────────────

  onYearChange(): void {
    this.selectedClassId = '';
    this.selectedSubjectId = '';
    this.selectedComponentKey = '';
    this.students = [];
    if (!this.selectedYearId) return;
    this.api.getClasses(this.selectedYearId).subscribe(r => {
      this.classes = (r as any)?.data ?? [];
    });
  }

  // ── class -> subjects (only those with INTERNAL components) ──────

  onClassChange(): void {
    this.selectedSubjectId = '';
    this.selectedComponentKey = '';
    this.internalComponents = [];
    this.students = [];
    if (!this.selectedClassId || !this.selectedYearId) return;
    this.subjectService
      .getSubjectsByClassAndYear(this.selectedClassId, this.selectedYearId)
      .subscribe(subs => {
        // Only show subjects that have at least one INTERNAL component —
        // EXAM-only subjects have no marks to enter here.
        this.subjects = subs.filter(s =>
          (s.components || []).some(c => c.assessmentMode === 'INTERNAL'));
      });
  }

  // ── subject -> components (INTERNAL only) ─────────────────────────

  onSubjectChange(): void {
    this.selectedComponentKey = '';
    this.selectedComponent = null;
    this.students = [];
    const sub = this.subjects.find(s => s.subjectId === this.selectedSubjectId);
    this.internalComponents = (sub?.components || []).filter(c => c.assessmentMode === 'INTERNAL');
    if (this.internalComponents.length === 1) {
      this.selectedComponentKey = this.internalComponents[0].key;
      this.selectedComponent = this.internalComponents[0];
    }
  }

  onComponentChange(): void {
    this.selectedComponent = this.internalComponents.find(c => c.key === this.selectedComponentKey) ?? null;
    this.selectedTermId = '';
    this.students = [];
  }

  // ── Load + save marks ─────────────────────────────────────────────

  loadMarks(): void {
    if (!this.canLoad()) return;
    this.isLoading = true;

    // 1) Load class roster (for student names).
    this.api.getStudents({ classId: this.selectedClassId, academicYearId: this.selectedYearId } as any)
      .subscribe({
        next: (r: any) => {
          const list: any[] = r?.data ?? [];
          // 2) Then fetch any existing marks so the grid pre-fills.
          this.http.get<any>(`${this.API}/internal-marks`, {
            params: {
              subjectId: this.selectedSubjectId,
              componentKey: this.selectedComponentKey,
              academicYearId: this.selectedYearId,
              ...(this.selectedComponent?.internalSchedule === 'PER_TERM' && this.selectedTermId
                ? { termId: this.selectedTermId } : {}),
            },
          }).subscribe({
            next: existing => {
              const marksByStudent = new Map<string, any>();
              for (const m of existing?.data ?? []) marksByStudent.set(m.studentId, m);
              this.students = list.map(s => {
                const existingMark = marksByStudent.get(s.studentId);
                return {
                  studentId: s.studentId,
                  name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.admissionNumber || s.studentId,
                  marksObtained: existingMark?.marksObtained ?? null,
                  remarks: existingMark?.remarks ?? '',
                };
              });
              this.isLoading = false;
            },
            error: () => {
              // Fall back to roster with empty marks if the GET fails.
              this.students = list.map(s => ({
                studentId: s.studentId,
                name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId,
                marksObtained: null,
                remarks: '',
              }));
              this.isLoading = false;
            },
          });
        },
        error: () => { this.isLoading = false; this.students = []; },
      });
  }

  saveMarks(): void {
    if (!this.canSave()) return;
    const max = this.selectedComponent?.maxMarks ?? 0;
    for (const s of this.students) {
      if (s.marksObtained != null && (s.marksObtained < 0 || s.marksObtained > max)) {
        this.snackBar.open(`Marks for ${s.name} must be between 0 and ${max}.`, 'Close', { duration: 4000 });
        return;
      }
    }
    this.isSaving = true;
    const payload = {
      subjectId: this.selectedSubjectId,
      componentKey: this.selectedComponentKey,
      academicYearId: this.selectedYearId,
      termId: this.selectedComponent?.internalSchedule === 'PER_TERM' ? this.selectedTermId : null,
      entries: this.students
        .filter(s => s.marksObtained != null)
        .map(s => ({ studentId: s.studentId, marksObtained: s.marksObtained, remarks: s.remarks })),
    };
    this.http.post<any>(`${this.API}/internal-marks`, payload).subscribe({
      next: () => {
        this.snackBar.open(`Saved ${payload.entries.length} mark${payload.entries.length === 1 ? '' : 's'}.`, 'Close', { duration: 3000 });
        this.isSaving = false;
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save marks', 'Close', { duration: 4000 });
        this.isSaving = false;
      },
    });
  }

  // ── Form-state helpers (template uses these) ──────────────────────

  canLoad(): boolean {
    if (!this.selectedYearId || !this.selectedClassId
        || !this.selectedSubjectId || !this.selectedComponentKey) return false;
    if (this.selectedComponent?.internalSchedule === 'PER_TERM' && !this.selectedTermId) return false;
    return true;
  }

  canSave(): boolean {
    return this.canLoad() && this.students.length > 0;
  }

  scheduleLabel(): string {
    if (!this.selectedComponent) return '';
    return this.selectedComponent.internalSchedule === 'PER_YEAR'
        ? 'One mark per student per academic year'
        : 'One mark per student per term';
  }
}
