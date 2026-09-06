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
    // admin disables on the Coordinator Access page (one-page tenant
    // gate). Used for delegating attendance / SMS / exam marking to a
    // coordinator without giving user-management or structural-setup
    // access.
    { value: UserRole.SCHOOL_COORDINATOR, label: 'School Coordinator' },
    // Distinct HR role for the payroll / employee-attendance operator.
    // A Principal who also runs HR gets BOTH roles assigned via the
    // multi-role checkboxes below.
    { value: UserRole.HR, label: 'HR / Payroll' },
  ];

  /** Roles the admin has ticked as EXTRA hats — never contains the
   *  primary role from the dropdown. The final granted list sent to
   *  the backend is `[primary, ...extraRoles]` (deduped). Kept as
   *  a set so ordering flips (e.g. changing primary) don't need
   *  index bookkeeping. */
  extraRoles = new Set<UserRole>();

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
    // No seed — extraRoles starts empty. Primary role is TEACHER by
    // default; the checkboxes below list every role except that one,
    // and admin ticks the extras they want to grant on top.

    if (this.isEditing) {
      this.loadUserData();
    }
  }

  /** Toggles an EXTRA role. No safeguards needed — extras are
   *  independent of the primary dropdown; unticking every extra is
   *  fine (the user keeps their primary role). */
  toggleRole(role: UserRole, checked: boolean): void {
    if (checked) {
      this.extraRoles.add(role);
    } else {
      this.extraRoles.delete(role);
    }
  }

  /** Ticked in the extra-roles checkbox list. */
  isRoleSelected(role: UserRole): boolean {
    return this.extraRoles.has(role);
  }

  /** Roles rendered as extra-role checkboxes — every role except
   *  the current primary. Getter recomputes on each render so the
   *  list swaps in/out the right role when the primary changes. */
  get extraRoleOptions(): { value: UserRole; label: string }[] {
    const primary = this.userForm?.get('role')?.value;
    return this.roles.filter(r => r.value !== primary);
  }

  /** Called when the admin picks a role in the "Primary role" dropdown.
   *  If that role was ticked as an extra before the change, drop it
   *  from the extras set — otherwise it would appear twice in the
   *  final payload and the checkbox row would silently exclude it. */
  onPrimaryRoleChange(role: UserRole): void {
    if (this.extraRoles.has(role)) {
      this.extraRoles.delete(role);
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
            role: res.data.activeRole || res.data.role,
          });
          // Seed the extra-roles set from the persisted list minus
          // the primary. Legacy users without a roles array have no
          // extras to seed.
          this.extraRoles.clear();
          const persistedRoles: UserRole[] = res.data.roles && res.data.roles.length
              ? res.data.roles : [res.data.role];
          const primary: UserRole = res.data.activeRole || res.data.role;
          persistedRoles
              .filter(r => r !== primary)
              .forEach(r => this.extraRoles.add(r));
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

    // Multi-role payload — full authorised list = [primary, ...extras].
    // Backend uses `role` as the initial active hat and `roles` as
    // the complete authorised list. Set semantics de-dupe defensively
    // in case the primary somehow leaked into extras.
    const primaryRole: UserRole = formData.role;
    const fullRoles = new Set<UserRole>([primaryRole, ...this.extraRoles]);
    formData.roles = Array.from(fullRoles);

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
