import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { WhatsAppMessage, WhatsAppMessageStatus } from '../../core/models';

@Component({
  selector: 'app-whatsapp-history',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatPaginatorModule, MatCardModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">WhatsApp Messages</h1>
        <button mat-flat-button class="gold-btn" (click)="router.navigate(['/whatsapp/compose'])">
          <mat-icon>add</mat-icon> Compose New
        </button>
      </div>

      <div *ngIf="loading" class="loading-wrapper">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <mat-card *ngIf="!loading" appearance="outlined" class="table-card">
        <div class="table-responsive">
          <table mat-table [dataSource]="messages" class="full-width-table">
            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let m">{{ m.createdAt | date:'medium' }}</td>
            </ng-container>
            <ng-container matColumnDef="recipientType">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let m">{{ m.recipientType }}</td>
            </ng-container>
            <ng-container matColumnDef="totalRecipients">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let m">{{ m.totalRecipients }}</td>
            </ng-container>
            <ng-container matColumnDef="successCount">
              <th mat-header-cell *matHeaderCellDef>Sent</th>
              <td mat-cell *matCellDef="let m">{{ m.successCount }}</td>
            </ng-container>
            <ng-container matColumnDef="failureCount">
              <th mat-header-cell *matHeaderCellDef>Failed</th>
              <td mat-cell *matCellDef="let m">{{ m.failureCount }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let m">
                <span class="status-chip" [ngClass]="getStatusClass(m.status)">{{ m.status }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let m">
                <button mat-icon-button matTooltip="View Details" (click)="$event.stopPropagation(); router.navigate(['/whatsapp', m.messageId])">
                  <mat-icon>visibility</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                class="clickable-row"
                (click)="router.navigate(['/whatsapp', row.messageId])"></tr>
            <tr class="mat-row no-data-row" *matNoDataRow>
              <td class="mat-cell" [attr.colspan]="displayedColumns.length">No messages found.</td>
            </tr>
          </table>
        </div>
        <mat-paginator
          [length]="totalElements"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50]"
          (page)="onPage($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .page-title { font-size: 28px; font-weight: 600; color: #333; margin: 0; }
    .gold-btn { background-color: #D4A843 !important; color: #fff !important; }
    .table-card { border-radius: 12px; overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .full-width-table { width: 100%; }
    .loading-wrapper { display: flex; justify-content: center; padding: 64px 0; }
    .no-data-row td { text-align: center; padding: 32px; color: #999; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: #f5f5f5; }
    .status-chip {
      display: inline-block; padding: 4px 12px; border-radius: 16px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
    }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    .status-processing { background: #e3f2fd; color: #1565c0; }
    .status-queued { background: #f5f5f5; color: #616161; }
    .status-partially-failed { background: #fff3e0; color: #e65100; }
    .status-failed { background: #fce4ec; color: #c62828; }
  `]
})
export class WhatsappHistoryComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  messages: WhatsAppMessage[] = [];
  displayedColumns = ['createdAt', 'recipientType', 'totalRecipients', 'successCount', 'failureCount', 'status', 'actions'];
  totalElements = 0;
  pageSize = 10;
  currentPage = 0;
  loading = true;

  constructor(private api: ApiService, public router: Router) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.loading = true;
    this.api.getWhatsAppMessages(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        const page = res.data;
        this.messages = page?.content || [];
        this.totalElements = page?.totalElements || 0;
        this.loading = false;
      },
      error: () => { this.messages = []; this.loading = false; }
    });
  }

  onPage(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadMessages();
  }

  getStatusClass(status: WhatsAppMessageStatus): string {
    const map: Record<string, string> = {
      COMPLETED: 'status-completed',
      PROCESSING: 'status-processing',
      QUEUED: 'status-queued',
      PARTIALLY_FAILED: 'status-partially-failed',
      FAILED: 'status-failed',
    };
    return map[status] || '';
  }
}
