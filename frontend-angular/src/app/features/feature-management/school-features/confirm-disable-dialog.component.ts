import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-disable-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="warning-icon">warning</mat-icon>
      Disable Feature
    </h2>
    <mat-dialog-content>
      <p class="dialog-message">
        Are you sure you want to disable <strong>{{ data.featureName }}</strong>?
        This will immediately hide it from the school's UI.
      </p>
      <mat-form-field appearance="outline" class="reason-field">
        <mat-label>Reason (optional)</mat-label>
        <textarea matInput [(ngModel)]="reason" rows="3" placeholder="Why are you disabling this feature?"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-flat-button color="warn" (click)="onConfirm()">Disable</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d32f2f;
    }
    .warning-icon {
      color: #ff9800;
    }
    .dialog-message {
      margin-bottom: 16px;
      color: #555;
      line-height: 1.5;
    }
    .reason-field {
      width: 100%;
    }
  `],
})
export class ConfirmDisableDialogComponent {
  reason = '';

  constructor(
    public dialogRef: MatDialogRef<ConfirmDisableDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { featureName: string },
  ) {}

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    this.dialogRef.close({ confirmed: true, reason: this.reason || undefined });
  }
}
