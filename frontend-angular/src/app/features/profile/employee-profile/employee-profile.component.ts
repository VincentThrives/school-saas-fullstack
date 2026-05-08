import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { ChangePasswordDialogComponent } from '../../../shared/components/change-password-dialog/change-password-dialog.component';

@Component({
  selector: 'app-employee-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    PageHeaderComponent,
  ],
  templateUrl: './employee-profile.component.html',
  styleUrl: '../profile-shared.scss',
})
export class EmployeeProfileComponent implements OnInit {
  teacher: any = null;
  user: any = null;
  isLoading = true;
  isSaving = false;
  isEditing = false;

  edit = {
    phone: '',
    email: '',
    qualification: '',
    specialization: '',
    address: { street: '', city: '', state: '', country: '', zip: '' },
    profilePhotoUrl: '',
  };

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  /** Opens the reusable Change Password dialog for the logged-in employee. */
  openChangePassword(): void {
    this.dialog.open(ChangePasswordDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  ngOnInit(): void {
    this.api.getMyTeacherProfile().subscribe({
      next: (res) => { this.teacher = res?.data || null; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
    this.api.getMyUserProfile().subscribe({
      next: (res) => { this.user = res?.data || null; },
      error: () => {},
    });
  }

  get teacherInitial(): string {
    return (this.teacher?.firstName?.[0] || '?').toUpperCase();
  }

  formatDob(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  /** Title-case the role enum for display. */
  prettyRole(r: string): string {
    if (!r) return '-';
    return r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  startEdit(): void {
    if (!this.teacher) return;
    this.edit = {
      phone: this.teacher.phone || '',
      email: this.teacher.email || '',
      qualification: this.teacher.qualification || '',
      specialization: this.teacher.specialization || '',
      address: {
        street:  this.teacher.address?.street || '',
        city:    this.teacher.address?.city || '',
        state:   this.teacher.address?.state || '',
        country: this.teacher.address?.country || '',
        zip:     this.teacher.address?.zip || '',
      },
      profilePhotoUrl: this.user?.profilePhotoUrl || '',
    };
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
  }

  save(): void {
    if (this.isSaving) return;
    this.isSaving = true;

    const teacherPayload = {
      phone: this.edit.phone || null,
      email: this.edit.email || null,
      qualification: this.edit.qualification || null,
      specialization: this.edit.specialization || null,
      address: this.edit.address,
    };
    const userPayload = {
      profilePhotoUrl: this.edit.profilePhotoUrl || null,
    };

    let pending = 2;
    let firstError: string | null = null;
    const finish = () => {
      if (--pending > 0) return;
      this.isSaving = false;
      if (firstError) {
        this.snackBar.open(firstError, 'Close', { duration: 4000 });
      } else {
        this.snackBar.open('Profile updated', 'Close', { duration: 2500 });
        this.isEditing = false;
        this.ngOnInit();
      }
    };

    this.api.updateMyEmployeeProfile(teacherPayload).subscribe({
      next: () => finish(),
      error: (err) => {
        firstError = err?.error?.message || 'Failed to update profile';
        finish();
      },
    });
    this.api.updateMyUserProfile(userPayload as any).subscribe({
      next: () => finish(),
      error: (err) => {
        if (!firstError) firstError = err?.error?.message || 'Failed to update photo';
        finish();
      },
    });
  }
}
