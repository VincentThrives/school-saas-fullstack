import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass } from '../../../core/models';

@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './teacher-form.component.html',
  styleUrl: './teacher-form.component.scss',
})
export class TeacherFormComponent implements OnInit {
  teacherForm!: FormGroup;
  isEditing = false;
  teacherId: string | null = null;
  isLoading = false;
  isSaving = false;

  classes: SchoolClass[] = [];
  selectedClassSections: { sectionId: string; name: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.teacherId = this.route.snapshot.paramMap.get('teacherId');
    this.isEditing = !!this.teacherId && this.teacherId !== 'new';

    this.teacherForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [''],
      phone: [''],
      employeeId: ['', Validators.required],
      qualification: [''],
      specialization: [''],
      joinDate: [''],
      classIds: [[]],
      subjectIds: [[]],
      isClassTeacher: [false],
      classTeacherOfClassId: [''],
      classTeacherOfSectionId: [''],
    });

    this.loadClasses();

    if (this.isEditing) {
      this.teacherForm.get('employeeId')?.disable();
      this.loadTeacher();
    }
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Teacher' : 'Add Teacher';
  }

  get isClassTeacher(): boolean {
    return this.teacherForm.get('isClassTeacher')?.value || false;
  }

  loadClasses(): void {
    this.apiService.getClasses().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.classes = Array.isArray(response.data) ? response.data : [];
        }
      },
    });
  }

  loadTeacher(): void {
    if (!this.teacherId) return;
    this.isLoading = true;
    this.apiService.getTeacherById(this.teacherId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const t = res.data;
          this.teacherForm.patchValue({
            firstName: t.firstName,
            lastName: t.lastName,
            email: t.email,
            phone: t.phone,
            employeeId: t.employeeId,
            qualification: t.qualification,
            specialization: t.specialization,
            joinDate: t.joinDate,
            classIds: t.classIds || [],
            subjectIds: t.subjectIds || [],
            isClassTeacher: t.isClassTeacher,
            classTeacherOfClassId: (t as any).classTeacherOfClassId || '',
            classTeacherOfSectionId: (t as any).classTeacherOfSectionId || '',
          });
          this.onClassTeacherClassChange();
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load teacher', 'Close', { duration: 3000 });
      },
    });
  }

  onClassTeacherClassChange(): void {
    const classId = this.teacherForm.get('classTeacherOfClassId')?.value;
    if (classId) {
      const cls = this.classes.find(c => c.classId === classId);
      this.selectedClassSections = cls?.sections || [];
    } else {
      this.selectedClassSections = [];
      this.teacherForm.patchValue({ classTeacherOfSectionId: '' });
    }
  }

  onSubmit(): void {
    if (this.teacherForm.invalid) {
      this.teacherForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formData = this.teacherForm.getRawValue();

    // Clean up: if not class teacher, clear the class/section
    if (!formData.isClassTeacher) {
      formData.classTeacherOfClassId = null;
      formData.classTeacherOfSectionId = null;
    }

    const request$ = this.isEditing && this.teacherId
      ? this.apiService.updateTeacher(this.teacherId, formData)
      : this.apiService.createTeacher(formData);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Teacher updated successfully' : 'Teacher created successfully',
          'Close',
          { duration: 3000 },
        );
        this.router.navigate(['/teachers']);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save teacher', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/teachers']);
  }
}
