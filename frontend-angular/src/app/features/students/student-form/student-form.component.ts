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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-student-form',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './student-form.component.html',
  styleUrl: './student-form.component.scss',
})
export class StudentFormComponent implements OnInit {
  studentForm!: FormGroup;
  isEditing = false;
  studentId: string | null = null;
  isLoading = false;
  isSaving = false;

  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];

  genders = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
  ];

  bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.studentId = this.route.snapshot.paramMap.get('studentId');
    this.isEditing = !!this.studentId && this.studentId !== 'new';

    this.studentForm = this.fb.group({
      admissionNumber: ['', Validators.required],
      rollNumber: [''],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      dateOfBirth: ['', Validators.required],
      gender: ['MALE', Validators.required],
      bloodGroup: [''],
      classId: ['', Validators.required],
      sectionId: [''],
      academicYearId: ['', Validators.required],
      parentIds: [[]],
      street: [''],
      city: [''],
      state: [''],
      zip: [''],
    });

    this.loadClasses();
    this.loadAcademicYears();

    if (this.isEditing) {
      this.loadStudentData();
    }
  }

  loadStudentData(): void {
    if (!this.studentId) return;
    this.isLoading = true;
    this.apiService.getStudentById(this.studentId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const s = res.data;
          this.studentForm.patchValue({
            firstName: s.firstName || '',
            lastName: s.lastName || '',
            admissionNumber: s.admissionNumber,
            rollNumber: s.rollNumber,
            dateOfBirth: s.dateOfBirth,
            gender: s.gender,
            bloodGroup: s.bloodGroup,
            classId: s.classId,
            sectionId: s.sectionId,
            academicYearId: s.academicYearId,
            street: s.address?.street || '',
            city: s.address?.city || '',
            state: s.address?.state || '',
            zip: s.address?.zip || '',
          });
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load student data', 'Close', { duration: 3000 });
      },
    });
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Student' : 'Add Student';
  }

  get selectedClassSections(): { name: string; capacity: number; sectionId?: string }[] {
    const classId = this.studentForm.get('classId')?.value;
    const cls = this.classes.find(c => c.classId === classId);
    return cls?.sections || [];
  }

  loadClasses(): void {
    this.apiService.getClasses().subscribe({
      next: (response) => {
        this.classes = response.data;
      },
    });
  }

  loadAcademicYears(): void {
    this.apiService.getAcademicYears().subscribe({
      next: (response) => {
        this.academicYears = response.data;
        if (!this.isEditing) {
          const current = this.academicYears.find(y => y.current);
          if (current) {
            this.studentForm.patchValue({ academicYearId: current.academicYearId });
          }
        }
      },
    });
  }

  onSubmit(): void {
    if (this.studentForm.invalid) {
      this.studentForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formData = this.studentForm.value;

    const payload = {
      ...formData,
      address: {
        street: formData.street || '',
        city: formData.city || '',
        state: formData.state || '',
        zip: formData.zip || '',
      },
    };
    delete payload.street;
    delete payload.city;
    delete payload.state;
    delete payload.zip;

    const request$ = this.isEditing && this.studentId
      ? this.apiService.updateStudent(this.studentId, payload)
      : this.apiService.createStudent(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Student updated successfully' : 'Student created successfully',
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/students']);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save student', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/students']);
  }
}
