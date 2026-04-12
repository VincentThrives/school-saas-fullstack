import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, WhatsAppRecipientInfo } from '../../../core/models';

@Component({
  selector: 'app-whatsapp-compose',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './whatsapp-compose.component.html',
  styleUrl: './whatsapp-compose.component.scss',
})
export class WhatsappComposeComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  recipientType: 'CLASS' | 'INDIVIDUAL' = 'CLASS';
  classId = '';
  messageBody = '';
  recipients: WhatsAppRecipientInfo[] = [];
  recipientColumns = ['parentName', 'phone'];

  classes: SchoolClass[] = [];

  mediaUrl = '';
  mediaFileName = '';
  mediaMimeType = '';

  isResolving = false;
  isUploading = false;
  isSending = false;

  readonly maxMessageLength = 4096;

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = res.data || [];
      },
    });
  }

  onRecipientTypeChange(): void {
    this.recipients = [];
    this.classId = '';
  }

  previewRecipients(): void {
    this.isResolving = true;
    this.api
      .resolveWhatsAppRecipients(
        this.recipientType,
        this.recipientType === 'CLASS' ? this.classId : undefined,
      )
      .subscribe({
        next: (res) => {
          this.recipients = res.data || [];
          this.isResolving = false;
        },
        error: () => {
          this.isResolving = false;
          this.snackBar.open('Failed to resolve recipients', 'Close', { duration: 3000 });
        },
      });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isUploading = true;
    this.api.uploadWhatsAppMedia(file).subscribe({
      next: (res) => {
        if (res.data) {
          this.mediaUrl = res.data.url;
          this.mediaFileName = res.data.fileName;
          this.mediaMimeType = res.data.mimeType;
        }
        this.isUploading = false;
      },
      error: () => {
        this.isUploading = false;
        this.snackBar.open('Failed to upload file', 'Close', { duration: 3000 });
      },
    });

    // Reset file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  removeMedia(): void {
    this.mediaUrl = '';
    this.mediaFileName = '';
    this.mediaMimeType = '';
  }

  get isSendDisabled(): boolean {
    return (
      !this.messageBody.trim() ||
      (this.recipientType === 'CLASS' && !this.classId) ||
      this.isSending
    );
  }

  get messageCharCount(): number {
    return this.messageBody.length;
  }

  sendMessage(): void {
    this.isSending = true;
    this.api
      .sendWhatsAppMessage({
        recipientType: this.recipientType,
        classId: this.recipientType === 'CLASS' ? this.classId : undefined,
        messageBody: this.messageBody,
        mediaUrl: this.mediaUrl || undefined,
        mediaFileName: this.mediaFileName || undefined,
        mediaMimeType: this.mediaMimeType || undefined,
      })
      .subscribe({
        next: () => {
          this.isSending = false;
          this.snackBar.open('Messages queued!', 'Close', { duration: 3000 });
          this.router.navigate(['/whatsapp']);
        },
        error: () => {
          this.isSending = false;
          this.snackBar.open('Failed to send message', 'Close', { duration: 3000 });
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/whatsapp']);
  }
}
