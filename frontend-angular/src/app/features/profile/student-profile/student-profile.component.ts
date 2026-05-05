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
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-student-profile',
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
    PageHeaderComponent,
  ],
  templateUrl: './student-profile.component.html',
  styleUrl: '../profile-shared.scss',
})
export class StudentProfileComponent implements OnInit {
  student: any = null;
  user: any = null;
  classes: any[] = [];
  isLoading = true;
  isSaving = false;
  isEditing = false;

  /** Editable form bound to the right-hand panel. Pre-populated from
   *  the loaded record on every Edit click so Cancel discards changes. */
  edit = {
    phone: '',
    email: '',
    bloodGroup: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    address: { street: '', city: '', state: '', zip: '' },
    profilePhotoUrl: '',
  };

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // Pull the User record (avatar / email) and the Student record (school
    // info + editable fields) in parallel.
    this.api.getMyStudentProfile().subscribe({
      next: (res) => {
        this.student = res?.data || null;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
    this.api.getMyUserProfile().subscribe({
      next: (res) => { this.user = res?.data || null; },
      error: () => { /* non-fatal */ },
    });
    // Resolve class name client-side — backend returns classId only.
    this.api.getClasses().subscribe({
      next: (res) => { this.classes = res?.data || []; },
      error: () => { this.classes = []; },
    });
  }

  get className(): string {
    if (!this.student?.classId) return '-';
    const cls = this.classes.find(c => c.classId === this.student.classId);
    if (!cls) return this.student.classId;
    const sec = (cls.sections || []).find((s: any) => s.sectionId === this.student.sectionId);
    return cls.name + (sec ? ` - ${sec.name}` : '');
  }

  get studentInitial(): string {
    return (this.student?.firstName?.[0] || '?').toUpperCase();
  }

  /** Pretty DD MMM YYYY. */
  formatDob(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  startEdit(): void {
    if (!this.student) return;
    // Snapshot current values into the edit model.
    this.edit = {
      phone: this.student.phone || '',
      email: this.student.email || '',
      bloodGroup: this.student.bloodGroup || '',
      parentName: this.student.parentName || '',
      parentPhone: this.student.parentPhone || '',
      parentEmail: this.student.parentEmail || '',
      address: {
        street: this.student.address?.street || '',
        city:   this.student.address?.city || '',
        state:  this.student.address?.state || '',
        zip:    this.student.address?.zip || '',
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

    // Two parallel saves: Student-record fields → /students/me/profile,
    // profile photo (lives on User) → /users/me. Both succeed/fail
    // independently; we surface a single snackbar at the end.
    const studentPayload = {
      phone: this.edit.phone || null,
      email: this.edit.email || null,
      bloodGroup: this.edit.bloodGroup || null,
      parentName: this.edit.parentName || null,
      parentPhone: this.edit.parentPhone || null,
      parentEmail: this.edit.parentEmail || null,
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
        this.ngOnInit(); // refresh
      }
    };

    this.api.updateMyStudentProfile(studentPayload).subscribe({
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
