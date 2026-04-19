import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
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
import { scrollToFirstInvalid } from '../../../shared/utils/form-scroll';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, EmployeeRole } from '../../../core/models';

@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
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
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private hostEl: ElementRef<HTMLElement>,
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
      // Address
      street: [''],
      city: [''],
      state: [''],
      country: [''],
      zip: [''],
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
          const addr = (t as any).address || {};
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
            street: addr.street || '',
            city: addr.city || '',
            state: addr.state || '',
            country: addr.country || '',
            zip: addr.zip || '',
          });

          // Class-subject assignments are now managed on the Teacher Assignments page (per-year).
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load employee data', 'Close', { duration: 3000 });
      },
    });
  }

  onSubmit(): void {
    if (this.employeeForm.invalid) {
      scrollToFirstInvalid(this.hostEl, this.employeeForm);
      this.snackBar.open('Please fill the highlighted required fields', 'Close', { duration: 3000 });
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
      // classSubjectAssignments intentionally omitted — managed via the
      // dedicated Teacher Assignments page (per-academic-year).
      address: {
        street: formData.street || '',
        city: formData.city || '',
        state: formData.state || '',
        country: formData.country || '',
        zip: formData.zip || '',
      },
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
