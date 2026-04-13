import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { AcademicYear, Teacher } from '../../../core/models';

@Component({
  selector: 'app-class-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './class-form.component.html',
  styleUrl: './class-form.component.scss',
})
export class ClassFormComponent implements OnInit {
  classForm!: FormGroup;
  isEditing = false;
  classId: string | null = null;
  isLoading = false;
  isSaving = false;

  academicYears: AcademicYear[] = [];
  teachers: Teacher[] = [];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('classId');
    this.isEditing = !!this.classId && this.classId !== 'new';

    this.classForm = this.fb.group({
      name: ['', Validators.required],
      academicYearId: ['', Validators.required],
      sections: this.fb.array([]),
    });

    this.subjectService.getSubjects().subscribe(subjects => {
      this.subjectsList = subjects.map(s => ({ id: s.subjectId, name: s.name }));
      this.subjectsList.push({ id: 'others', name: 'Others' });
    });

    this.loadAcademicYears();
    this.loadTeachers();

    if (!this.isEditing) {
      this.addSection();
    }
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Class' : 'Add Class';
  }

  get sections(): FormArray {
    return this.classForm.get('sections') as FormArray;
  }

  loadAcademicYears(): void {
    this.apiService.getAcademicYears().subscribe({
      next: (response) => {
        const data = response.data;
        this.academicYears = Array.isArray(data) ? data : (data as any)?.content || [];
        if (!this.isEditing) {
          const current = this.academicYears.find(y => y.current);
          if (current) {
            this.classForm.patchValue({ academicYearId: current.academicYearId });
          }
        }
        if (this.isEditing) {
          this.loadClassData();
        }
      },
    });
  }

  loadClassData(): void {
    if (!this.classId) return;
    this.isLoading = true;
    this.apiService.getClassById(this.classId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const cls = res.data;
          this.classForm.patchValue({
            name: cls.name,
            academicYearId: cls.academicYearId,
          });
          // Clear and rebuild sections
          this.sections.clear();
          (cls.sections || []).forEach(s => {
            this.sections.push(this.fb.group({
              name: [s.name, Validators.required],
              capacity: [s.capacity, [Validators.required, Validators.min(1)]],
              classTeacherId: [s.classTeacherId || ''],
              subjectIds: [s.subjectIds || []],
            }));
          });
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load class data', 'Close', { duration: 3000 });
      },
    });
  }

  loadTeachers(): void {
    this.apiService.getTeachers(0, 100).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.teachers = res.data.content || [];
        }
      },
    });
  }

  getTeacherName(teacher: Teacher): string {
    if (teacher.firstName) {
      return `${teacher.firstName} ${teacher.lastName || ''}`.trim();
    }
    return `Teacher ${teacher.employeeId || ''}`;
  }

  subjectsList: { id: string; name: string }[] = [];

  customSubject = '';

  addCustomSubject(sectionIndex: number): void {
    if (this.customSubject.trim()) {
      const name = this.customSubject.trim();
      const id = name.toLowerCase().replace(/\s+/g, '_');

      // Add to subjects list before "Others"
      if (!this.subjectsList.find(s => s.id === id)) {
        const othersIdx = this.subjectsList.findIndex(s => s.id === 'others');
        if (othersIdx >= 0) {
          this.subjectsList.splice(othersIdx, 0, { id, name });
        } else {
          this.subjectsList.push({ id, name });
        }
      }

      // Auto-select the new subject and remove "others"
      const section = this.sections.at(sectionIndex);
      const currentIds: string[] = section.get('subjectIds')?.value || [];
      const updated = currentIds.filter(s => s !== 'others');
      if (!updated.includes(id)) updated.push(id);
      section.get('subjectIds')?.setValue(updated);

      this.customSubject = '';
    }
  }

  addSection(): void {
    const sectionGroup = this.fb.group({
      name: ['', Validators.required],
      capacity: [40, [Validators.required, Validators.min(1)]],
      classTeacherId: [''],
      subjectIds: [[]],
    });
    this.sections.push(sectionGroup);
  }

  removeSection(index: number): void {
    this.sections.removeAt(index);
  }

  onSubmit(): void {
    if (this.classForm.invalid) {
      this.classForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formData = this.classForm.value;

    const request$ = this.isEditing && this.classId
      ? this.apiService.updateClass(this.classId, formData)
      : this.apiService.createClass(formData);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Class updated successfully' : 'Class created successfully',
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/classes']);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save class', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/classes']);
  }
}
