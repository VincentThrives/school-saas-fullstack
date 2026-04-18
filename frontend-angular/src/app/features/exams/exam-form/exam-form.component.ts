import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { scrollToFirstInvalid } from '../../../shared/utils/form-scroll';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-exam-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './exam-form.component.html',
  styleUrl: './exam-form.component.scss',
})
export class ExamFormComponent implements OnInit {
  examForm!: FormGroup;
  isEditing = false;
  examId: string | null = null;
  isSaving = false;
  isLoading = false;
  isLoadingSubjects = false;

  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  sections: { name: string; capacity: number; sectionId?: string; subjectIds?: string[] }[] = [];
  subjectsList: SubjectItem[] = [];
  examTypes: any[] = [];

  private pendingSubjectId: string | null = null;
  private pendingClassId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private hostEl: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId');
    this.isEditing = !!this.examId && this.examId !== 'new';

    this.examForm = this.fb.group({
      examType: ['', Validators.required],
      name: ['', Validators.required],
      academicYearId: ['', Validators.required],
      classId: ['', Validators.required],
      sectionId: ['', Validators.required],
      subjectId: ['', Validators.required],
      subjectName: [''],
      examDate: [null, Validators.required],
      startTime: [''],
      endTime: [''],
      maxMarks: [100, [Validators.required, Validators.min(1)]],
      passingMarks: [35, [Validators.required, Validators.min(0)]],
      description: [''],
    });

    // Auto-set subjectName when subjectId changes
    this.examForm.get('subjectId')?.valueChanges.subscribe((value) => {
      const sub = this.subjectsList.find(s => s.subjectId === value);
      this.examForm.get('subjectName')?.setValue(sub?.name || value || '');
    });

    // Load exam types for the picker; auto-fill maxMarks from the catalog when empty/default
    this.api.getExamTypes().subscribe({
      next: (res) => { this.examTypes = res?.data || []; },
    });
    this.examForm.get('examType')?.valueChanges.subscribe((name) => {
      if (!name) return;
      const picked = this.examTypes.find(t => t.name === name);
      const currentMax = this.examForm.get('maxMarks')?.value;
      // Only auto-fill when the max is still the default (100) or empty
      if (picked?.defaultMaxMarks && (currentMax === 100 || currentMax == null || currentMax === '')) {
        this.examForm.patchValue({ maxMarks: picked.defaultMaxMarks });
      }
    });

    // Listen for sectionId changes to re-filter subjects
    this.examForm.get('sectionId')?.valueChanges.subscribe(() => {
      if (!this.isLoading) this.loadSubjectsForSelection();
    });

    // Load academic years
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
        if (!this.isEditing) {
          const current = this.academicYears.find((y) => y.current);
          if (current) {
            this.examForm.patchValue({ academicYearId: current.academicYearId });
            this.loadClassesForYear(current.academicYearId);
          }
        } else {
          this.loadExamData();
        }
      },
    });
  }

  onAcademicYearChange(): void {
    const yearId = this.examForm.get('academicYearId')?.value;
    this.examForm.patchValue({ classId: '', sectionId: '', subjectId: '' });
    this.classes = [];
    this.sections = [];
    this.subjectsList = [];
    if (yearId) {
      this.loadClassesForYear(yearId);
    }
  }

  private loadClassesForYear(academicYearId: string): void {
    this.api.getClasses(academicYearId).subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        // If editing and we have a pending classId, set it now
        if (this.pendingClassId) {
          this.examForm.patchValue({ classId: this.pendingClassId });
          this.pendingClassId = null;
          this.onClassChange(false);
          this.loadSubjectsForSelection();
        }
      },
    });
  }

  loadExamData(): void {
    if (!this.examId) return;
    this.isLoading = true;
    this.api.getExamById(this.examId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const e = res.data;
          this.pendingSubjectId = e.subjectId || null;
          this.pendingClassId = e.classId || null;

          this.examForm.patchValue({
            examType: e.examType || '',
            name: e.name,
            academicYearId: e.academicYearId,
            sectionId: e.sectionId,
            subjectName: e.subjectName || '',
            examDate: e.examDate,
            startTime: e.startTime || '',
            endTime: e.endTime || '',
            maxMarks: e.maxMarks,
            passingMarks: e.passingMarks,
            description: e.description || '',
          });

          this.isLoading = false;
          // Load classes for this academic year (will set pendingClassId after)
          if (e.academicYearId) {
            this.loadClassesForYear(e.academicYearId);
          }
        }
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam data', 'Close', { duration: 3000 });
      },
    });
  }

  onClassChange(clearSubject = true): void {
    const classId = this.examForm.get('classId')?.value;
    const selectedClass = this.classes.find((c) => c.classId === classId);
    this.sections = selectedClass?.sections || [];

    if (clearSubject) {
      this.examForm.patchValue({ sectionId: '', subjectId: '' });
      this.subjectsList = [];
      this.loadSubjectsForSelection();
    }
  }

  loadSubjectsForSelection(): void {
    const classId = this.examForm.get('classId')?.value;
    const sectionId = this.examForm.get('sectionId')?.value;

    if (!classId) {
      this.subjectsList = [];
      return;
    }

    const selectedClass = this.classes.find(c => c.classId === classId);
    let subjectIds: string[] = [];

    if (sectionId) {
      const section = selectedClass?.sections?.find(s => s.sectionId === sectionId);
      subjectIds = section?.subjectIds || [];
    } else {
      const allIds = new Set<string>();
      selectedClass?.sections?.forEach(s => {
        (s.subjectIds || []).forEach(id => allIds.add(id));
      });
      subjectIds = Array.from(allIds);
    }

    if (subjectIds.length === 0) {
      this.subjectsList = [];
      this.isLoadingSubjects = false;
      return;
    }

    this.isLoadingSubjects = true;
    this.subjectService.getSubjectsByIds(subjectIds).subscribe({
      next: (subjects) => {
        this.subjectsList = subjects;
        if (this.pendingSubjectId) {
          this.examForm.patchValue({ subjectId: this.pendingSubjectId });
          this.pendingSubjectId = null;
        }
        this.isLoadingSubjects = false;
      },
      error: () => {
        this.subjectsList = [];
        this.isLoadingSubjects = false;
      },
    });
  }

  get classDisabled(): boolean {
    return !this.examForm.get('academicYearId')?.value;
  }

  get subjectDisabled(): boolean {
    return !this.examForm.get('classId')?.value;
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Exam' : 'Create Exam';
  }

  onSubmit(): void {
    if (this.examForm.invalid) {
      scrollToFirstInvalid(this.hostEl, this.examForm);
      this.snackBar.open('Please fill the highlighted required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData = this.examForm.value;

    let examDate = formData.examDate;
    if (examDate instanceof Date) {
      const y = examDate.getFullYear();
      const m = String(examDate.getMonth() + 1).padStart(2, '0');
      const d = String(examDate.getDate()).padStart(2, '0');
      examDate = `${y}-${m}-${d}`;
    }

    const selectedClass = this.classes.find(c => c.classId === formData.classId);
    const selectedSection = this.sections.find(s => s.sectionId === formData.sectionId);

    const payload = {
      ...formData,
      examDate,
      className: selectedClass?.name || '',
      sectionName: selectedSection?.name || '',
    };

    const request$ = this.isEditing && this.examId
      ? this.api.updateExam(this.examId, payload)
      : this.api.createExam(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open(
          this.isEditing ? 'Exam updated successfully' : 'Exam created successfully',
          'Close', { duration: 3000 }
        );
        this.router.navigate(['/exams']);
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save exam', 'Close', { duration: 3000 });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/exams']);
  }
}
