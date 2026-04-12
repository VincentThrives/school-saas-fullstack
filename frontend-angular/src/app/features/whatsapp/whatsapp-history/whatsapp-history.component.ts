import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { WhatsAppMessage, WhatsAppMessageStatus } from '../../../core/models';

@Component({
  selector: 'app-whatsapp-history',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './whatsapp-history.component.html',
  styleUrl: './whatsapp-history.component.scss',
})
export class WhatsappHistoryComponent implements OnInit {
  messages: WhatsAppMessage[] = [];
  displayedColumns = ['date', 'type', 'className', 'total', 'sent', 'failed', 'status', 'actions'];
  isLoading = false;
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.isLoading = true;
    this.api.getWhatsAppMessages(this.pageIndex, this.pageSize).subscribe({
      next: (res) => {
        this.messages = res.data?.content || [];
        this.totalElements = res.data?.totalElements || 0;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadMessages();
  }

  getStatusClass(status: WhatsAppMessageStatus): string {
    switch (status) {
      case WhatsAppMessageStatus.COMPLETED: return 'status-completed';
      case WhatsAppMessageStatus.PROCESSING: return 'status-processing';
      case WhatsAppMessageStatus.QUEUED: return 'status-queued';
      case WhatsAppMessageStatus.PARTIALLY_FAILED: return 'status-partial';
      case WhatsAppMessageStatus.FAILED: return 'status-failed';
      default: return '';
    }
  }

  compose(): void {
    this.router.navigate(['/whatsapp/compose']);
  }

  viewDetail(messageId: string): void {
    this.router.navigate(['/whatsapp', messageId]);
  }

  onRowClick(message: WhatsAppMessage): void {
    this.viewDetail(message.messageId);
  }
}
