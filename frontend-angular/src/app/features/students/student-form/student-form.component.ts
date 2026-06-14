import { Component, ElementRef, OnInit } from '@angular/core';
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
import { scrollToFirstInvalid } from '../../../shared/utils/form-scroll';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService, SubjectItem } from '../../../core/services/subject.service';
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
  subjectsList: SubjectItem[] = [];

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
    private snackBar: MatSnackBar,
    private subjectService: SubjectService,
    private hostEl: ElementRef<HTMLElement>,
  ) {}

  /** Datepicker bounds: max = today (no future DOB), startAt = ~10 years ago
   *  so the multi-year view opens near a likely student birth year instead
   *  of the current decade. */
  todayForDob: Date = new Date();
  dobStartAt: Date = new Date(new Date().getFullYear() - 10, 0, 1);

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
      sectionId: ['', Validators.required],
      academicYearId: ['', Validators.required],
      parentIds: [[]],
      parentName: [''],
      // Required — parent phone doubles as the student's login username
      // ("9876543210" for the first child, "9876543210pari" for siblings).
      // Accepts an optional country-code prefix; backend strips it via
      // StudentFieldNormalizer.phoneDigits before storing.
      parentPhone: ['', [Validators.required, Validators.pattern(/^(\+?\d{1,3})?\d{10}$/)]],
      parentEmail: [''],
      subjectIds: [[]],
      street: [''],
      city: [''],
      state: [''],
      zip: [''],
    });

    this.loadAcademicYears();

    // Listen for section changes to reload subjects
    this.studentForm.get('sectionId')?.valueChanges.subscribe(() => {
      if (!this.isLoading) this.loadSubjectsForStudent();
    });

    if (this.isEditing) {
      this.loadStudentData();
    }
  }

  loadSubjectsForStudent(): void {
    const classId = this.studentForm.get('classId')?.value;
    const sectionId = this.studentForm.get('sectionId')?.value;

    if (!classId) {
      this.subjectsList = [];
      return;
    }

    const cls = this.classes.find(c => c.classId === classId);
    let subjectIds: string[] = [];

    if (sectionId) {
      const section = cls?.sections?.find(s => s.sectionId === sectionId);
      subjectIds = section?.subjectIds || [];
    } else {
      const allIds = new Set<string>();
      cls?.sections?.forEach(s => (s.subjectIds || []).forEach(id => allIds.add(id)));
      subjectIds = Array.from(allIds);
    }

    if (subjectIds.length === 0) {
      this.subjectsList = [];
      return;
    }

    this.subjectService.getSubjectsByIds(subjectIds).subscribe({
      next: (subjects) => {
        this.subjectsList = subjects;
      },
      error: () => {
        this.subjectsList = [];
      },
    });
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
            academicYearId: s.academicYearId,
            parentName: s.parentName || '',
            parentPhone: s.parentPhone || '',
            parentEmail: s.parentEmail || '',
            subjectIds: s.subjectIds || [],
            street: s.address?.street || '',
            city: s.address?.city || '',
            state: s.address?.state || '',
            zip: s.address?.zip || '',
          });
          // Load classes for this student's academic year, then set classId/sectionId
          if (s.academicYearId) {
            this.apiService.getClasses(s.academicYearId).subscribe({
              next: (clsRes) => {
                this.classes = Array.isArray(clsRes.data) ? clsRes.data : [];
                this.studentForm.patchValue({ classId: s.classId, sectionId: s.sectionId });
                this.loadSubjectsForStudent();
              },
            });
          }
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

  onAcademicYearChange(): void {
    this.studentForm.patchValue({ classId: '', sectionId: '' });
    this.classes = [];
    this.subjectsList = [];
    const yearId = this.studentForm.get('academicYearId')?.value;
    if (yearId) {
      this.loadClassesForYear(yearId);
    }
  }

  onClassChange(): void {
    this.studentForm.patchValue({ sectionId: '' });
    this.subjectsList = [];
    this.loadSubjectsForStudent();
  }

  private loadClassesForYear(yearId: string): void {
    this.apiService.getClasses(yearId).subscribe({
      next: (response) => {
        this.classes = Array.isArray(response.data) ? response.data : [];
      },
    });
  }

  loadAcademicYears(): void {
    this.apiService.getAcademicYears().subscribe({
      next: (response) => {
        this.academicYears = Array.isArray(response.data) ? response.data : [];
        if (!this.isEditing) {
          const current = this.academicYears.find(y => y.current);
          if (current) {
            this.studentForm.patchValue({ academicYearId: current.academicYearId });
            this.loadClassesForYear(current.academicYearId);
          }
        }
      },
    });
  }

  onSubmit(): void {
    if (this.studentForm.invalid) {
      scrollToFirstInvalid(this.hostEl, this.studentForm);
      this.snackBar.open('Please fill the highlighted required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData = this.studentForm.value;

    // mat-datepicker hands us a JS Date; the backend's LocalDate expects
    // an ISO "yyyy-MM-dd" string. toISOString() shifts to UTC and can roll
    // the day back, so build the string from local Y/M/D components.
    const dob = formData.dateOfBirth;
    const dobStr = dob instanceof Date
      ? `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`
      : dob;

    const payload = {
      ...formData,
      dateOfBirth: dobStr,
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
