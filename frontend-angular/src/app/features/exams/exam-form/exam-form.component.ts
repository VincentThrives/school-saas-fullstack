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
      name: ['', Validators.required],
      classId: ['', Validators.required],
      sectionId: [''],
      academicYearId: ['', Validators.required],
      subjectId: ['', Validators.required],
      examDate: [null, Validators.required],
      maxMarks: [100, [Validators.required, Validators.min(1)]],
      passingMarks: [35, [Validators.required, Validators.min(0)]],
      description: [''],
    });

    this.api.getClasses().subscribe({ next: (res) => (this.classes = res.data || []) });
    this.api.getAcademicYears().subscribe({
      next: (res) => {
        this.academicYears = res.data || [];
        const current = this.academicYears.find((y) => y.current);
        if (current && !this.isEditing) {
          this.examForm.patchValue({ academicYearId: current.academicYearId });
        }
      },
    });
  }

  onClassChange(): void {
    const classId = this.examForm.get('classId')?.value;
    const selectedClass = this.classes.find((c) => c.id === classId);
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

    this.api.createExam(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Exam saved successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/exams']);
      },
      error: () => {
        this.isSaving = false;
        this.snackBar.open('Failed to save exam', 'Close', { duration: 3000 });
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
