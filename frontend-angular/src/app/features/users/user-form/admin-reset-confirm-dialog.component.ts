import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Confirmation step before the admin clicks "Reset Password" on a
 * student/employee. Spells out exactly what's about to happen — the
 * password becomes the default rule (firstName@birthYear) and the
 * user must use that to log in next time.
 *
 * Returns boolean via dialogRef.close():
 *   - true  → admin confirmed, parent caller fires the API call
 *   - false → admin cancelled, no-op
 */
@Component({
  selector: 'app-admin-reset-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="warn-icon">warning_amber</mat-icon>
      Reset password?
    </h2>
    <mat-dialog-content>
      <p>
        This will reset the password for
        <strong>{{ data.name || data.username }}</strong>
        back to the default rule (<code>firstName&#64;birthYear</code>).
      </p>
      <p class="hint">
        The user will need to use the new password to sign in. They can change
        it themselves later via Change Password.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Cancel</button>
      <button mat-flat-button color="warn" (click)="dialogRef.close(true)">
        <mat-icon>lock_reset</mat-icon>
        Reset Password
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .warn-icon {
      color: #f57c00;
    }
    p {
      margin: 8px 0;
      line-height: 1.55;
    }
    .hint {
      color: #6b7280;
      font-size: 0.875rem;
    }
    code {
      background: #f3f4f6;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.85em;
    }
  `],
})
export class AdminResetConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AdminResetConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string; username: string },
  ) {}
}
