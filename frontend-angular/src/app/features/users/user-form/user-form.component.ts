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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { UserRole } from '../../../core/models';

@Component({
  selector: 'app-user-form',
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
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup;
  isEditing = false;
  userId: string | null = null;
  isLoading = false;
  isSaving = false;

  roles = [
    { value: UserRole.SCHOOL_ADMIN, label: 'School Admin' },
    { value: UserRole.PRINCIPAL, label: 'Principal' },
    { value: UserRole.TEACHER, label: 'Teacher' },
    { value: UserRole.STUDENT, label: 'Student' },
    { value: UserRole.PARENT, label: 'Parent' },
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('userId');
    this.isEditing = !!this.userId && this.userId !== 'new';

    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', this.isEditing ? [] : [Validators.required, Validators.minLength(8)]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: [''],
      role: [UserRole.TEACHER, Validators.required],
    });

    if (this.isEditing) {
      this.loadUserData();
    }
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit User' : 'Create User';
  }

  loadUserData(): void {
    if (!this.userId) return;
    this.isLoading = true;
    this.apiService.getUserById(this.userId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.userForm.patchValue({
            email: res.data.email,
            firstName: res.data.firstName,
            lastName: res.data.lastName,
            phone: res.data.phone || '',
            role: res.data.role,
          });
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load user data', 'Close', { duration: 3000 });
      },
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formData = this.userForm.getRawValue();

    // Remove empty password for update
    if (this.isEditing && !formData.password) {
      delete formData.password;
    }

    const request$ = this.isEditing && this.userId
      ? this.apiService.updateUser(this.userId, formData)
      : this.apiService.createUser(formData);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'User updated successfully' : 'User created successfully',
          'Close',
          { duration: 3000 },
        );
        this.router.navigate(['/users']);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save user', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/users']);
  }

  getErrorMessage(field: string): string {
    const control = this.userForm.get(field);
    if (control?.hasError('required')) return `${this.getFieldLabel(field)} is required`;
    if (control?.hasError('email')) return 'Invalid email address';
    if (control?.hasError('minlength')) return 'Password must be at least 8 characters';
    return '';
  }

  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      email: 'Email', password: 'Password', firstName: 'First name',
      lastName: 'Last name', role: 'Role',
    };
    return labels[field] || field;
  }
}
