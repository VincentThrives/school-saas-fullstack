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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { scrollToFirstInvalid } from '../../../shared/utils/form-scroll';
import { ApiService } from '../../../core/services/api.service';
import { UserRole } from '../../../core/models';
import { AdminResetConfirmDialogComponent } from './admin-reset-confirm-dialog.component';

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
    MatTabsModule,
    MatDialogModule,
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
  /** Toggles the password input between hidden (•••) and plain text. */
  showPassword = false;

  /** Loaded user record (only populated when editing). Powers the
   *  Password tab — needed to (a) show name/role, (b) decide whether
   *  the admin-reset rule applies (only for users linked to a Student
   *  or Teacher record; another SCHOOL_ADMIN doesn't have a DOB). */
  loadedUser: any = null;
  isResettingPassword = false;

  roles = [
    { value: UserRole.SCHOOL_ADMIN, label: 'School Admin' },
    { value: UserRole.PRINCIPAL, label: 'Principal' },
    { value: UserRole.TEACHER, label: 'Teacher' },
    { value: UserRole.STUDENT, label: 'Student' },
    { value: UserRole.PARENT, label: 'Parent' },
    // Sees the same sidenav as School Admin minus the modules the
    // admin disables on the Staff Access page (one-page tenant gate).
    // Used for delegating attendance / SMS / exam marking to staff
    // without giving them user-management or structural-setup access.
    { value: UserRole.SCHOOL_STAFF, label: 'School Staff' },
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private hostEl: ElementRef<HTMLElement>,
    private dialog: MatDialog,
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
          this.loadedUser = res.data;
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

  /** True when the admin-reset rule applies — only students and teachers
   *  have a linked record with a DOB the rule (firstName@birthYear) can
   *  derive from. SCHOOL_ADMIN / PRINCIPAL must use Change Password. */
  get canAdminReset(): boolean {
    const role = this.loadedUser?.role;
    return role === UserRole.STUDENT || role === UserRole.TEACHER;
  }

  /** Triggered from the Password tab. Confirm → POST → snackbar with the
   *  plaintext password so the admin can copy it. The 30-second snackbar
   *  duration is intentional: long enough for the admin to read out the
   *  password to a parent on the phone, short enough that the password
   *  doesn't linger on a shared screen if the admin walks away. */
  onAdminResetPassword(): void {
    if (!this.userId || !this.loadedUser || !this.canAdminReset) return;
    const fullName = `${this.loadedUser.firstName || ''} ${this.loadedUser.lastName || ''}`.trim();

    const confirmRef = this.dialog.open(AdminResetConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      data: { name: fullName, username: this.loadedUser.username || this.loadedUser.email },
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.isResettingPassword = true;
      this.apiService.adminResetPassword(this.userId!).subscribe({
        next: (res) => {
          this.isResettingPassword = false;
          const newPwd = res?.data?.newPassword || '';
          // Show the password in a long-lived snackbar with a Copy action.
          // We deliberately avoid logging it anywhere.
          const ref = this.snackBar.open(
            `New password: ${newPwd}`,
            'Copy',
            { duration: 30000, panelClass: ['pwd-snackbar'] },
          );
          ref.onAction().subscribe(() => {
            navigator.clipboard?.writeText(newPwd).then(
              () => this.snackBar.open('Password copied to clipboard', 'OK', { duration: 2500 }),
              () => { /* clipboard blocked — leave the visible value as fallback */ },
            );
          });
        },
        error: (err) => {
          this.isResettingPassword = false;
          this.snackBar.open(
            err?.error?.message || 'Failed to reset password',
            'Close',
            { duration: 5000 },
          );
        },
      });
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      scrollToFirstInvalid(this.hostEl, this.userForm);
      this.snackBar.open('Please fill the highlighted required fields', 'Close', { duration: 3000 });
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
