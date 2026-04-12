import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import {
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppDeliveryStatus,
} from '../../../core/models';

@Component({
  selector: 'app-whatsapp-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './whatsapp-detail.component.html',
  styleUrl: './whatsapp-detail.component.scss',
})
export class WhatsappDetailComponent implements OnInit {
  message: WhatsAppMessage | null = null;
  isLoading = false;
  isError = false;
  recipientColumns = ['parentName', 'phone', 'deliveryStatus', 'errorMessage'];

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const messageId = this.route.snapshot.paramMap.get('messageId');
    if (messageId) {
      this.loadMessage(messageId);
    }
  }

  loadMessage(messageId: string): void {
    this.isLoading = true;
    this.api.getWhatsAppMessageById(messageId).subscribe({
      next: (res) => {
        this.message = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.isError = true;
      },
    });
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

  getDeliveryStatusClass(status: WhatsAppDeliveryStatus): string {
    switch (status) {
      case WhatsAppDeliveryStatus.SENT:
      case WhatsAppDeliveryStatus.DELIVERED:
        return 'delivery-success';
      case WhatsAppDeliveryStatus.PENDING:
        return 'delivery-pending';
      case WhatsAppDeliveryStatus.FAILED:
        return 'delivery-failed';
      default:
        return '';
    }
  }

  getDeliveryIcon(status: WhatsAppDeliveryStatus): string {
    switch (status) {
      case WhatsAppDeliveryStatus.SENT:
      case WhatsAppDeliveryStatus.DELIVERED:
        return 'check_circle';
      case WhatsAppDeliveryStatus.PENDING:
        return 'hourglass_empty';
      case WhatsAppDeliveryStatus.FAILED:
        return 'error';
      default:
        return 'help';
    }
  }

  goBack(): void {
    this.router.navigate(['/whatsapp']);
  }
}
