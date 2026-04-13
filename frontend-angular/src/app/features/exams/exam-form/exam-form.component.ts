import { Component, OnInit } from '@angular/core';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
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
    MatProgressSpinnerModule,
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

  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];
  sections: { name: string; capacity: number; sectionId?: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId');
    this.isEditing = !!this.examId && this.examId !== 'new';

    this.examForm = this.fb.group({
      examType: ['UNIT_TEST', Validators.required],
      name: ['', Validators.required],
      classId: ['', Validators.required],
      sectionId: [''],
      academicYearId: ['', Validators.required],
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
      const subjectMap: Record<string, string> = {
        math: 'Mathematics', science: 'Science', english: 'English', hindi: 'Hindi',
        kannada: 'Kannada', sanskrit: 'Sanskrit', social: 'Social Studies', history: 'History',
        geography: 'Geography', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology',
        computer: 'Computer Science', evs: 'EVS', pe: 'Physical Education',
      };
      this.examForm.get('subjectName')?.setValue(subjectMap[value] || value);
    });

    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        if (this.isEditing) this.loadExamData();
      },
    });
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        const data = res.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
        const current = this.academicYears.find((y) => y.current);
        if (current && !this.isEditing) {
          this.examForm.patchValue({ academicYearId: current.academicYearId });
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
          this.examForm.patchValue({
            examType: e.examType || 'UNIT_TEST',
            name: e.name,
            classId: e.classId,
            sectionId: e.sectionId,
            academicYearId: e.academicYearId,
            subjectId: e.subjectId,
            subjectName: e.subjectName || '',
            examDate: e.examDate,
            startTime: e.startTime || '',
            endTime: e.endTime || '',
            maxMarks: e.maxMarks,
            passingMarks: e.passingMarks,
            description: e.description || '',
          });
          this.onClassChange();
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load exam data', 'Close', { duration: 3000 });
      },
    });
  }

  onClassChange(): void {
    const classId = this.examForm.get('classId')?.value;
    const selectedClass = this.classes.find((c) => c.classId === classId);
    this.sections = selectedClass?.sections || [];
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Exam' : 'Create Exam';
  }

  onSubmit(): void {
    if (this.examForm.invalid) return;

    this.isSaving = true;
    const formData = this.examForm.value;

    const payload = {
      ...formData,
      date: this.formatDate(formData.examDate),
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

  private formatDate(date: Date): string {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
