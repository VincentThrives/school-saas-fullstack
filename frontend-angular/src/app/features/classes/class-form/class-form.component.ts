import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
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
import { AcademicYear } from '../../../core/models';

@Component({
  selector: 'app-class-form',
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

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
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

    this.loadAcademicYears();

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
        this.academicYears = response.data;
        if (!this.isEditing) {
          const current = this.academicYears.find(y => y.isCurrent);
          if (current) {
            this.classForm.patchValue({ academicYearId: current.id });
          }
        }
      },
    });
  }

  addSection(): void {
    const sectionGroup = this.fb.group({
      name: ['', Validators.required],
      capacity: [40, [Validators.required, Validators.min(1)]],
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

    this.apiService.createClass(formData).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Class updated successfully' : 'Class created successfully',
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/classes']);
      },
      error: () => {
        this.snackBar.open('Failed to save class', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/classes']);
  }
}
