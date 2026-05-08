import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Two-line confirmation step before the actual fan-out fires.
 * Returns boolean via dialogRef.close() — true = go ahead, false = cancel.
 */
@Component({
  selector: 'app-publish-result-confirm',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="title">
      <mat-icon class="icon" [class.warn]="data.republishing">campaign</mat-icon>
      {{ data.republishing ? 'Re-publish result?' : 'Publish result?' }}
    </h2>
    <mat-dialog-content>
      <p>
        <strong>{{ data.sampleTitle }}</strong>
      </p>
      <p>
        Sending personalised notifications to
        <strong>{{ data.studentCount }}</strong> student(s) and
        <strong>{{ data.parentCount }}</strong> parent account(s).
      </p>
      <p class="hint">
        This cannot be unsent. Recipients will see the result in their inbox
        and as a push notification on their phones.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Cancel</button>
      <button mat-flat-button color="primary" (click)="dialogRef.close(true)">
        <mat-icon>send</mat-icon>
        {{ data.republishing ? 'Re-publish' : 'Publish' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .title { display: flex; align-items: center; gap: 8px; }
    .icon { color: #1976d2; }
    .icon.warn { color: #f57c00; }
    p { margin: 8px 0; line-height: 1.55; }
    .hint { color: #6b7280; font-size: 0.875rem; }
  `],
})
export class PublishResultConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PublishResultConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      studentCount: number;
      parentCount: number;
      sampleTitle: string;
      republishing: boolean;
    },
  ) {}
}
