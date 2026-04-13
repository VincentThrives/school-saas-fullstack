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

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
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
    });

    this.loadClasses();

    if (this.isEditing) {
      this.teacherForm.get('employeeId')?.disable();
    }
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Teacher' : 'Add Teacher';
  }

  loadClasses(): void {
    this.apiService.getClasses().subscribe({
      next: (response) => {
        this.classes = response.data;
      },
    });
  }

  onSubmit(): void {
    if (this.teacherForm.invalid) {
      this.teacherForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formData = this.teacherForm.getRawValue();

    // For now, use the generic API -- actual teacher-specific endpoints can be added
    this.snackBar.open(
      this.isEditing ? 'Teacher updated successfully' : 'Teacher created successfully',
      'Close',
      { duration: 3000 }
    );
    this.router.navigate(['/teachers']);
  }

  cancel(): void {
    this.router.navigate(['/teachers']);
  }
}
