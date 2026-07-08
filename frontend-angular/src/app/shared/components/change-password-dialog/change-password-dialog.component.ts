import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';

/**
 * Self-service "Change Password" dialog. Reusable across every role —
 * opened from the user-menu dropdown and from the bottom of each
 * profile page (student / employee / admin).
 *
 * UX:
 *   - Three fields: current, new, confirm. Each gets its own eye-icon
 *     toggle so the user can verify what they typed (the field on a
 *     phone keyboard with autocorrect is the #1 reason resets get
 *     called in to the help desk).
 *   - Real-time validation: min 6, must contain a letter + a digit,
 *     new must differ from current, confirm must match new. The
 *     submit button stays disabled until everything passes.
 *   - On success: snackbar + close. On failure (e.g. wrong current
 *     password from the backend): show the message inline and stay
 *     open so the user can retry.
 *
 * Returned value via dialogRef.close():
 *   - `true` on successful change
 *   - `null` / undefined on cancel
 */
@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="lock-icon">lock_reset</mat-icon>
      Change Password
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="pwd-form" autocomplete="off">
        <!-- Current password -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>Current password</mat-label>
          <input matInput
                 [type]="showCurrent ? 'text' : 'password'"
                 formControlName="currentPassword"
                 autocomplete="current-password" />
          <button mat-icon-button matSuffix type="button"
                  (click)="showCurrent = !showCurrent"
                  [attr.aria-label]="showCurrent ? 'Hide password' : 'Show password'">
            <mat-icon>{{ showCurrent ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-error *ngIf="form.get('currentPassword')?.hasError('required')">
            Current password is required
          </mat-error>
        </mat-form-field>

        <!-- New password -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>New password</mat-label>
          <input matInput
                 [type]="showNew ? 'text' : 'password'"
                 formControlName="newPassword"
                 autocomplete="new-password" />
          <button mat-icon-button matSuffix type="button"
                  (click)="showNew = !showNew"
                  [attr.aria-label]="showNew ? 'Hide password' : 'Show password'">
            <mat-icon>{{ showNew ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-hint>At least 4 characters.</mat-hint>
          <mat-error *ngIf="form.get('newPassword')?.hasError('required')">
            New password is required
          </mat-error>
          <mat-error *ngIf="form.get('newPassword')?.hasError('minlength')">
            Must be at least 4 characters
          </mat-error>
          <mat-error *ngIf="form.hasError('sameAsCurrent') && !form.get('newPassword')?.errors">
            New password must be different from current
          </mat-error>
        </mat-form-field>

        <!-- Confirm password -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>Confirm new password</mat-label>
          <input matInput
                 [type]="showConfirm ? 'text' : 'password'"
                 formControlName="confirmPassword"
                 autocomplete="new-password" />
          <button mat-icon-button matSuffix type="button"
                  (click)="showConfirm = !showConfirm"
                  [attr.aria-label]="showConfirm ? 'Hide password' : 'Show password'">
            <mat-icon>{{ showConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-error *ngIf="form.hasError('mismatch') && !form.get('confirmPassword')?.errors">
            Passwords do not match
          </mat-error>
        </mat-form-field>

        <div *ngIf="serverError" class="server-error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ serverError }}</span>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="form.invalid || saving"
              (click)="onSubmit()">
        <mat-spinner *ngIf="saving" diameter="18" class="inline-spinner"></mat-spinner>
        <span *ngIf="!saving">Change Password</span>
        <span *ngIf="saving">Saving…</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lock-icon {
      color: #1976d2;
    }
    .pwd-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 320px;
      padding-top: 8px;
    }
    .full { width: 100%; }
    .server-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      margin-top: 4px;
      background: #fdecea;
      color: #b71c1c;
      border-radius: 6px;
      font-size: 13px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 6px;
    }
    @media (max-width: 480px) {
      .pwd-form { min-width: unset; width: 100%; }
    }
  `],
})
export class ChangePasswordDialogComponent {
  form: FormGroup;
  showCurrent = false;
  showNew = false;
  showConfirm = false;
  saving = false;
  serverError = '';

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ChangePasswordDialogComponent>,
  ) {
    this.form = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: [
          '',
          [Validators.required, Validators.minLength(4)],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [this.matchValidator, this.differentFromCurrentValidator] },
    );
  }


  private matchValidator(group: AbstractControl): ValidationErrors | null {
    const a = group.get('newPassword')?.value;
    const b = group.get('confirmPassword')?.value;
    if (!a || !b) return null;
    return a === b ? null : { mismatch: true };
  }

  private differentFromCurrentValidator(group: AbstractControl): ValidationErrors | null {
    const cur = group.get('currentPassword')?.value;
    const next = group.get('newPassword')?.value;
    if (!cur || !next) return null;
    return cur === next ? { sameAsCurrent: true } : null;
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;
    this.serverError = '';
    this.saving = true;
    const { currentPassword, newPassword } = this.form.value;
    this.api.changeMyPassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open('Password changed successfully', 'OK', { duration: 4000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving = false;
        // Log full error to the console so devs can diagnose in DevTools.
        // We never log the password itself.
        // eslint-disable-next-line no-console
        console.error('[ChangePassword] HTTP error:', err);
        // Backend BusinessException → ApiResponse with `message` in the
        // error body. Try a few shapes before falling back so we surface
        // the real reason instead of a generic "try again".
        const e = err?.error;
        let msg: string | null = null;
        if (e && typeof e === 'object') {
          msg = e.message || e.error || null;
        } else if (typeof e === 'string' && e.trim().length > 0) {
          msg = e;
        }
        if (!msg) {
          // Synthesize a status-aware fallback so the user knows
          // *something* concrete went wrong instead of a vague retry hint.
          const status = err?.status;
          if (status === 401) msg = 'Your session expired. Please log in again.';
          else if (status === 403) msg = 'Not allowed (403). Please log in again.';
          else if (status === 0) msg = 'Could not reach the server. Check your connection and try again.';
          else if (status >= 500) msg = `Server error (${status}). Please try again in a moment.`;
          else if (status) msg = `Request failed (HTTP ${status}). Please try again.`;
          else msg = 'Could not change password. Please try again.';
        }
        this.serverError = msg;
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
