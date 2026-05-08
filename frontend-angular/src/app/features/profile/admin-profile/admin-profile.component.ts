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
  selector: 'app-admin-profile',
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
  templateUrl: './admin-profile.component.html',
  styleUrl: '../profile-shared.scss',
})
export class AdminProfileComponent implements OnInit {
  user: any = null;
  isLoading = true;
  isSaving = false;
  isEditing = false;

  edit = {
    phone: '',
    email: '',
    profilePhotoUrl: '',
  };

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  /** Opens the reusable Change Password dialog for the logged-in admin. */
  openChangePassword(): void {
    this.dialog.open(ChangePasswordDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  ngOnInit(): void {
    this.api.getMyUserProfile().subscribe({
      next: (res) => { this.user = res?.data || null; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
  }

  get adminInitial(): string {
    return (this.user?.firstName?.[0] || this.user?.username?.[0] || '?').toUpperCase();
  }

  prettyRole(r: string): string {
    if (!r) return '-';
    return r.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }

  formatDateTime(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  startEdit(): void {
    if (!this.user) return;
    this.edit = {
      phone: this.user.phone || '',
      email: this.user.email || '',
      profilePhotoUrl: this.user.profilePhotoUrl || '',
    };
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
  }

  save(): void {
    if (this.isSaving) return;
    this.isSaving = true;
    const payload: any = {
      phone: this.edit.phone || null,
      email: this.edit.email || null,
      profilePhotoUrl: this.edit.profilePhotoUrl || null,
    };
    this.api.updateMyUserProfile(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Profile updated', 'Close', { duration: 2500 });
        this.isEditing = false;
        this.ngOnInit();
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to update profile', 'Close', { duration: 4000 });
      },
    });
  }
}
