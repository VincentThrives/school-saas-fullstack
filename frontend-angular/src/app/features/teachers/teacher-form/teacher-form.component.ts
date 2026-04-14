import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
import { SchoolClass, EmployeeRole } from '../../../core/models';

@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './teacher-form.component.html',
  styleUrl: './teacher-form.component.scss',
})
export class TeacherFormComponent implements OnInit {
  employeeForm!: FormGroup;
  isEditing = false;
  teacherId: string | null = null;
  isLoading = false;
  isSaving = false;

  classes: SchoolClass[] = [];

  // Per-assignment row: sections and subjects
  assignmentSections: { sectionId: string; name: string; subjectIds?: string[] }[][] = [];
  assignmentSubjects: SubjectItem[][] = [];

  employeeRoles: { value: EmployeeRole; label: string }[] = [
    { value: 'TEACHER', label: 'Teacher' },
    { value: 'ACCOUNTANT', label: 'Accountant' },
    { value: 'CLERK', label: 'Clerk' },
    { value: 'PRINCIPAL', label: 'Principal' },
    { value: 'HEAD_MISTRESS', label: 'Head Mistress' },
    { value: 'LAB_ASSISTANT', label: 'Lab Assistant' },
    { value: 'NON_TEACHING', label: 'Non-Teaching Staff' },
  ];

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.teacherId = this.route.snapshot.paramMap.get('teacherId');
    this.isEditing = !!this.teacherId && this.teacherId !== 'new';

    this.employeeForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [''],
      phone: [''],
      employeeId: ['', Validators.required],
      employeeRole: ['TEACHER', Validators.required],
      qualification: [''],
      specialization: [''],
      dateOfBirth: [''],
      joiningDate: [''],
      isClassTeacher: [false],
      classTeacherOfClassId: [''],
      classTeacherOfSectionId: [''],
      classSubjectAssignments: this.fb.array([]),
    });

    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        if (this.isEditing) this.loadEmployeeData();
      },
    });
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Employee' : 'Add Employee';
  }

  get assignments(): FormArray {
    return this.employeeForm.get('classSubjectAssignments') as FormArray;
  }

  get isTeacherRole(): boolean {
    return this.employeeForm.get('employeeRole')?.value === 'TEACHER';
  }

  get isClassTeacherChecked(): boolean {
    return this.employeeForm.get('isClassTeacher')?.value;
  }

  get classTeacherSections(): { sectionId: string; name: string }[] {
    const classId = this.employeeForm.get('classTeacherOfClassId')?.value;
    const cls = this.classes.find(c => c.classId === classId);
    return cls?.sections || [];
  }

  loadEmployeeData(): void {
    if (!this.teacherId) return;
    this.isLoading = true;
    this.api.getTeacherById(this.teacherId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const t = res.data;
          this.employeeForm.patchValue({
            firstName: t.firstName || '',
            lastName: t.lastName || '',
            email: t.email || '',
            phone: t.phone || '',
            employeeId: t.employeeId || '',
            employeeRole: t.employeeRole || 'TEACHER',
            qualification: t.qualification || '',
            specialization: t.specialization || '',
            dateOfBirth: t.dateOfBirth || '',
            joiningDate: t.joiningDate || t.joinDate || '',
            isClassTeacher: t.isClassTeacher || t.classTeacher || false,
            classTeacherOfClassId: t.classTeacherOfClassId || '',
            classTeacherOfSectionId: t.classTeacherOfSectionId || '',
          });

          // Load class-subject assignments
          this.assignments.clear();
          this.assignmentSections = [];
          this.assignmentSubjects = [];
          if (t.classSubjectAssignments && t.classSubjectAssignments.length > 0) {
            t.classSubjectAssignments.forEach((a, idx) => {
              this.assignments.push(this.fb.group({
                classId: [a.classId, Validators.required],
                sectionId: [a.sectionId, Validators.required],
                subjectId: [a.subjectId, Validators.required],
              }));
              this.loadSectionsForRow(idx, a.classId);
              this.loadSubjectsForRow(idx, a.classId, a.sectionId);
            });
          }
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load employee data', 'Close', { duration: 3000 });
      },
    });
  }

  addAssignment(): void {
    this.assignments.push(this.fb.group({
      classId: ['', Validators.required],
      sectionId: ['', Validators.required],
      subjectId: ['', Validators.required],
    }));
    this.assignmentSections.push([]);
    this.assignmentSubjects.push([]);
  }

  removeAssignment(index: number): void {
    this.assignments.removeAt(index);
    this.assignmentSections.splice(index, 1);
    this.assignmentSubjects.splice(index, 1);
  }

  onAssignmentClassChange(index: number): void {
    const classId = this.assignments.at(index).get('classId')?.value;
    this.assignments.at(index).patchValue({ sectionId: '', subjectId: '' });
    this.assignmentSubjects[index] = [];
    this.loadSectionsForRow(index, classId);
  }

  onAssignmentSectionChange(index: number): void {
    const classId = this.assignments.at(index).get('classId')?.value;
    const sectionId = this.assignments.at(index).get('sectionId')?.value;
    this.assignments.at(index).patchValue({ subjectId: '' });
    this.loadSubjectsForRow(index, classId, sectionId);
  }

  private loadSectionsForRow(index: number, classId: string): void {
    const cls = this.classes.find(c => c.classId === classId);
    while (this.assignmentSections.length <= index) this.assignmentSections.push([]);
    this.assignmentSections[index] = cls?.sections || [];
  }

  private loadSubjectsForRow(index: number, classId: string, sectionId: string): void {
    while (this.assignmentSubjects.length <= index) this.assignmentSubjects.push([]);
    if (!classId || !sectionId) {
      this.assignmentSubjects[index] = [];
      return;
    }
    const cls = this.classes.find(c => c.classId === classId);
    const section = cls?.sections?.find(s => s.sectionId === sectionId);
    const subjectIds = section?.subjectIds || [];
    if (subjectIds.length === 0) {
      this.assignmentSubjects[index] = [];
      return;
    }
    this.subjectService.getSubjectsByIds(subjectIds).subscribe({
      next: (subjects) => { this.assignmentSubjects[index] = subjects; },
      error: () => { this.assignmentSubjects[index] = []; },
    });
  }

  onSubmit(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formData = this.employeeForm.value;

    const payload: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email || null,
      phone: formData.phone || null,
      employeeId: formData.employeeId,
      employeeRole: formData.employeeRole,
      qualification: formData.qualification || null,
      specialization: formData.specialization || null,
      classTeacher: formData.isClassTeacher || false,
      classTeacherOfClassId: formData.classTeacherOfClassId || null,
      classTeacherOfSectionId: formData.classTeacherOfSectionId || null,
      classSubjectAssignments: this.isTeacherRole ? (formData.classSubjectAssignments || []) : [],
    };
    // Only send dates if they have a value (avoid sending empty string to LocalDate)
    if (formData.dateOfBirth) {
      payload.dateOfBirth = formData.dateOfBirth;
    }
    if (formData.joiningDate) {
      payload.joiningDate = formData.joiningDate;
    }

    const request$ = this.isEditing && this.teacherId
      ? this.api.updateTeacher(this.teacherId, payload)
      : this.api.createTeacher(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open(
          this.isEditing ? 'Employee updated successfully' : 'Employee created successfully',
          'Close', { duration: 3000 }
        );
        this.router.navigate(['/employees']);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Save employee error:', err);
        const msg = err?.error?.message || err?.statusText || 'Failed to save employee';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/employees']);
  }
}
