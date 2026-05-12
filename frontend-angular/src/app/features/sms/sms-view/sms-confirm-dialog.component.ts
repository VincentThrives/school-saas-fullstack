import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Data shape passed in via {@code MAT_DIALOG_DATA} when opening the
 * confirm dialog. Keeping the API generic so the same component can
 * back the absence-alert confirm, the custom-notice confirm, and any
 * future "are you sure you want to send N SMSes?" flow.
 */
export interface SmsConfirmData {
  /** Big icon at the top — Material icon name. Picks the tone (event_busy,
   *  campaign, send, etc.). */
  icon: string;
  /** Headline question, e.g. "Send absence SMS to 2 parents?" */
  title: string;
  /** Plain-text recipient summary. e.g. "all students' parents and all teachers" */
  audience?: string;
  /** Preview of the body the parent will see (custom notice path) — quoted. */
  messagePreview?: string;
  /** Number of SMS that will actually be sent (post-dedupe). Drives cost calc. */
  recipientCount: number;
  /** Rupee cost per SMS. Cost preview is recipientCount × this. */
  costPerSms: number;
  /** Optional extra line shown in muted text below cost — e.g.
   *  "Students already SMS'd today are skipped automatically." */
  footnote?: string;
  /** Button label for the destructive action. Defaults to "Send". */
  confirmLabel?: string;
}

/**
 * Branded confirmation dialog used by every "send SMS" flow on the
 * SMS Notifications page. Replaces the native {@code window.confirm()}
 * with a Material dialog that matches the gold theme, shows the
 * recipient count + cost breakdown clearly, and gives the admin a
 * proper Cancel/Send choice.
 *
 * <p>Opened via {@code MatDialog.open(SmsConfirmDialogComponent, { data: {...} })}.
 * Returns {@code true} from {@code afterClosed()} when the admin clicks
 * Send, {@code undefined}/{@code false} on Cancel.</p>
 */
@Component({
  selector: 'app-sms-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="scd-icon">
      <mat-icon>{{ data.icon }}</mat-icon>
    </div>

    <h2 mat-dialog-title class="scd-title">{{ data.title }}</h2>

    <mat-dialog-content class="scd-content">
      <div class="scd-audience" *ngIf="data.audience">
        <mat-icon class="scd-inline-icon">groups</mat-icon>
        <span>{{ data.audience }}</span>
      </div>

      <blockquote class="scd-preview" *ngIf="data.messagePreview">
        {{ data.messagePreview }}
      </blockquote>

      <!-- Stats grid only when we know the recipient count up-front.
           Broadcasts resolve the audience server-side, so they pass
           recipientCount = 0 and we show only the cost reminder. -->
      <div class="scd-stats" *ngIf="data.recipientCount > 0">
        <div class="scd-stat">
          <div class="scd-stat-num">{{ data.recipientCount }}</div>
          <div class="scd-stat-lbl">Recipients</div>
        </div>
        <div class="scd-stat-sep">×</div>
        <div class="scd-stat">
          <div class="scd-stat-num">₹{{ data.costPerSms | number:'1.2-2' }}</div>
          <div class="scd-stat-lbl">Per SMS</div>
        </div>
        <div class="scd-stat-sep">=</div>
        <div class="scd-stat scd-stat-total">
          <div class="scd-stat-num">₹{{ totalCost() | number:'1.2-2' }}</div>
          <div class="scd-stat-lbl">Estimated</div>
        </div>
      </div>

      <div class="scd-rate" *ngIf="data.recipientCount === 0">
        <mat-icon class="scd-inline-icon">paid</mat-icon>
        <span>Each SMS costs <strong>₹{{ data.costPerSms | number:'1.2-2' }}</strong>
              against your monthly budget.</span>
      </div>

      <p class="scd-footnote" *ngIf="data.footnote">
        <mat-icon class="scd-inline-icon">info</mat-icon>
        {{ data.footnote }}
      </p>

      <p class="scd-warn">
        <mat-icon class="scd-inline-icon">lock</mat-icon>
        This action cannot be undone.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="scd-actions">
      <button mat-button (click)="dialogRef.close(false)">Cancel</button>
      <button mat-flat-button color="primary" class="scd-confirm-btn"
              (click)="dialogRef.close(true)">
        <mat-icon>send</mat-icon>
        {{ data.confirmLabel || 'Send' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      // Constrain width inside the dialog so long titles wrap nicely
      // and the stat row never feels cramped.
      max-width: 480px;
    }
    .scd-icon {
      display: flex;
      justify-content: center;
      margin: 4px 0 8px;
      mat-icon {
        width: 56px;
        height: 56px;
        font-size: 56px;
        color: #D4A843;
      }
    }
    .scd-title {
      text-align: center;
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0 0 8px;
      color: #1a1a1a;
      line-height: 1.3;
    }
    .scd-content {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-top: 4px;
      // Material's default footer/header creates a horizontal scrollbar
      // on Windows for content with code/blockquote — clamp it.
      overflow-x: hidden;
    }
    .scd-audience {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(212, 168, 67, 0.10);
      border-left: 3px solid #D4A843;
      border-radius: 6px;
      color: #1a1a1a;
      font-size: 0.92rem;
      line-height: 1.4;
    }
    .scd-preview {
      margin: 0;
      padding: 12px 14px;
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      color: #1a1a1a;
      font-size: 0.92rem;
      font-style: italic;
      line-height: 1.4;
      // Word-break so an over-long message can't blow the dialog wide.
      word-break: break-word;
    }
    .scd-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 4px;
      background: #fff;
      border: 1px dashed #d1d5db;
      border-radius: 10px;
    }
    .scd-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 72px;
    }
    .scd-stat-num {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1a1a1a;
      font-variant-numeric: tabular-nums;
    }
    .scd-stat-lbl {
      font-size: 0.72rem;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      color: #6b7280;
    }
    .scd-stat-total .scd-stat-num { color: #B8860B; }
    .scd-stat-sep {
      font-size: 1.1rem;
      color: #9ca3af;
      font-weight: 500;
    }
    .scd-rate {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #fff;
      border: 1px dashed #d1d5db;
      border-radius: 8px;
      font-size: 0.92rem;
      color: #1a1a1a;
      strong { color: #B8860B; font-weight: 700; }
    }
    .scd-footnote, .scd-warn {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 0;
      font-size: 0.85rem;
      line-height: 1.4;
      color: #6b7280;
    }
    .scd-warn { color: #b45309; }
    .scd-inline-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .scd-actions {
      padding: 12px 4px 4px;
      gap: 6px;
    }
    .scd-confirm-btn {
      height: 44px;
      padding: 0 22px;
      font-weight: 700;
      mat-icon { margin-right: 6px; }
    }

    // ── Dark theme ──────────────────────────────────────────────
    :host-context(body.dark-theme) {
      .scd-title { color: #f5f5f5; }
      .scd-audience {
        background: rgba(212, 168, 67, 0.18);
        color: #f5f5f5;
      }
      .scd-preview {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.12);
        color: #f5f5f5;
      }
      .scd-stats {
        background: rgba(255, 255, 255, 0.03);
        border-color: rgba(255, 255, 255, 0.18);
      }
      .scd-stat-num { color: #f5f5f5; }
      .scd-stat-lbl { color: rgba(255, 255, 255, 0.55); }
      .scd-stat-total .scd-stat-num { color: #f6c969; }
      .scd-stat-sep { color: rgba(255, 255, 255, 0.45); }
      .scd-rate {
        background: rgba(255, 255, 255, 0.03);
        border-color: rgba(255, 255, 255, 0.18);
        color: #f5f5f5;
        strong { color: #f6c969; }
      }
      .scd-footnote { color: rgba(255, 255, 255, 0.65); }
      .scd-warn     { color: #f6c969; }
    }
  `],
})
export class SmsConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SmsConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: SmsConfirmData,
  ) {}

  totalCost(): number {
    return (this.data.recipientCount || 0) * (this.data.costPerSms || 0);
  }
}
