import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { WhatsAppMessage, WhatsAppMessageStatus, WhatsAppDeliveryStatus } from '../../core/models';

@Component({
  selector: 'app-whatsapp-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="page-container">
      <button mat-button (click)="router.navigate(['/whatsapp'])" class="back-btn">
        <mat-icon>arrow_back</mat-icon> Back to Messages
      </button>

      <div *ngIf="loading" class="loading-wrapper">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <div *ngIf="!loading && message">
        <mat-card appearance="outlined" class="info-card">
          <mat-card-header>
            <mat-card-title>Message Details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Sent By</span>
                <span class="info-value">{{ message.sentByName }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date</span>
                <span class="info-value">{{ message.createdAt | date:'medium' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status</span>
                <span class="status-chip" [ngClass]="getMessageStatusClass(message.status)">{{ message.status }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total</span>
                <span class="info-value">{{ message.totalRecipients }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Sent</span>
                <span class="info-value success-text">{{ message.successCount }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Failed</span>
                <span class="info-value error-text">{{ message.failureCount }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="body-card">
          <mat-card-header>
            <mat-card-title>Message</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="message-body">{{ message.messageBody }}</p>
            <div *ngIf="message.mediaFileName" class="attachment-info">
              <mat-icon>attach_file</mat-icon>
              <span>{{ message.mediaFileName }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="recipients-card">
          <mat-card-header>
            <mat-card-title>Recipients</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="table-responsive">
              <table mat-table [dataSource]="message.recipients" class="full-width-table">
                <ng-container matColumnDef="parentName">
                  <th mat-header-cell *matHeaderCellDef>Name</th>
                  <td mat-cell *matCellDef="let r">{{ r.parentName }}</td>
                </ng-container>
                <ng-container matColumnDef="phone">
                  <th mat-header-cell *matHeaderCellDef>Phone</th>
                  <td mat-cell *matCellDef="let r">{{ r.phone }}</td>
                </ng-container>
                <ng-container matColumnDef="deliveryStatus">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let r">
                    <span class="status-chip" [ngClass]="getDeliveryStatusClass(r.deliveryStatus)">{{ r.deliveryStatus }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="errorMessage">
                  <th mat-header-cell *matHeaderCellDef>Error</th>
                  <td mat-cell *matCellDef="let r">{{ r.errorMessage || '-' }}</td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="recipientColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: recipientColumns;"></tr>
              </table>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div *ngIf="!loading && error" class="error-banner">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1000px; margin: 0 auto; }
    .back-btn { margin-bottom: 16px; }
    .loading-wrapper { display: flex; justify-content: center; padding: 64px 0; }
    .info-card, .body-card, .recipients-card { border-radius: 12px; margin-bottom: 20px; }
    .info-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 20px; padding-top: 16px;
    }
    .info-item { display: flex; flex-direction: column; gap: 4px; }
    .info-label { font-size: 12px; color: #888; font-weight: 500; text-transform: uppercase; }
    .info-value { font-size: 16px; font-weight: 500; color: #333; }
    .success-text { color: #2e7d32; }
    .error-text { color: #c62828; }
    .message-body { font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap; padding-top: 12px; }
    .attachment-info { display: flex; align-items: center; gap: 6px; margin-top: 12px; color: #666; font-size: 14px; }
    .table-responsive { overflow-x: auto; }
    .full-width-table { width: 100%; }
    .status-chip {
      display: inline-block; padding: 4px 12px; border-radius: 16px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
    }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    .status-processing { background: #e3f2fd; color: #1565c0; }
    .status-queued { background: #f5f5f5; color: #616161; }
    .status-partially-failed { background: #fff3e0; color: #e65100; }
    .status-failed { background: #fce4ec; color: #c62828; }
    .status-sent { background: #e8f5e9; color: #2e7d32; }
    .status-delivered { background: #e8f5e9; color: #1b5e20; }
    .status-pending { background: #f5f5f5; color: #616161; }
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 16px; background: #fdecea; color: #d32f2f; border-radius: 8px;
    }
  `]
})
export class WhatsappDetailComponent implements OnInit {
  message: WhatsAppMessage | null = null;
  loading = true;
  error: string | null = null;
  recipientColumns = ['parentName', 'phone', 'deliveryStatus', 'errorMessage'];

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    public router: Router
  ) {}

  ngOnInit(): void {
    const messageId = this.route.snapshot.paramMap.get('messageId');
    if (!messageId) {
      this.error = 'No message ID provided.';
      this.loading = false;
      return;
    }
    this.api.getWhatsAppMessageById(messageId).subscribe({
      next: (res) => { this.message = res.data; this.loading = false; },
      error: () => { this.error = 'Failed to load message details.'; this.loading = false; }
    });
  }

  getMessageStatusClass(status: WhatsAppMessageStatus): string {
    const map: Record<string, string> = {
      COMPLETED: 'status-completed', PROCESSING: 'status-processing',
      QUEUED: 'status-queued', PARTIALLY_FAILED: 'status-partially-failed',
      FAILED: 'status-failed',
    };
    return map[status] || '';
  }

  getDeliveryStatusClass(status: WhatsAppDeliveryStatus): string {
    const map: Record<string, string> = {
      SENT: 'status-sent', DELIVERED: 'status-delivered',
      PENDING: 'status-pending', FAILED: 'status-failed',
    };
    return map[status] || '';
  }
}
