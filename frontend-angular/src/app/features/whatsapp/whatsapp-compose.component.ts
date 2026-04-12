import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { SchoolClass, WhatsAppRecipientInfo, SendWhatsAppRequest } from '../../core/models';

@Component({
  selector: 'app-whatsapp-compose',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatRadioModule, MatTableModule,
    MatProgressSpinnerModule, MatSnackBarModule
  ],
  template: `
    <div class="page-container">
      <h1 class="page-title">Compose WhatsApp Message</h1>

      <mat-card appearance="outlined" class="compose-card">
        <mat-card-content>
          <div class="form-section">
            <label class="section-label">Send To</label>
            <mat-radio-group [(ngModel)]="recipientType" class="radio-group">
              <mat-radio-button value="CLASS">By Class</mat-radio-button>
              <mat-radio-button value="INDIVIDUAL">Individual</mat-radio-button>
            </mat-radio-group>
          </div>

          <div *ngIf="recipientType === 'CLASS'" class="form-section">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Class</mat-label>
              <mat-select [(ngModel)]="selectedClassId">
                <mat-option *ngFor="let cls of classes" [value]="cls.id">{{ cls.name }}</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button (click)="previewRecipients()" [disabled]="!selectedClassId || previewLoading">
              <mat-icon>preview</mat-icon> Preview Recipients
            </button>
          </div>

          <div *ngIf="recipients.length > 0" class="form-section">
            <label class="section-label">Recipients ({{ recipients.length }})</label>
            <div class="table-responsive">
              <table mat-table [dataSource]="recipients" class="full-width-table recipients-table">
                <ng-container matColumnDef="parentName">
                  <th mat-header-cell *matHeaderCellDef>Parent Name</th>
                  <td mat-cell *matCellDef="let r">{{ r.parentName }}</td>
                </ng-container>
                <ng-container matColumnDef="phone">
                  <th mat-header-cell *matHeaderCellDef>Phone</th>
                  <td mat-cell *matCellDef="let r">{{ r.phone }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['parentName', 'phone']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['parentName', 'phone'];"></tr>
              </table>
            </div>
          </div>

          <div *ngIf="previewLoading" class="loading-wrapper-small">
            <mat-spinner diameter="28"></mat-spinner>
          </div>

          <div class="form-section">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Message</mat-label>
              <textarea matInput
                [(ngModel)]="messageBody"
                rows="6"
                maxlength="4096"
                placeholder="Type your message here..."></textarea>
              <mat-hint align="end">{{ messageBody.length }} / 4096</mat-hint>
            </mat-form-field>
          </div>

          <div class="form-section">
            <button mat-stroked-button (click)="fileInput.click()">
              <mat-icon>attach_file</mat-icon> Attach File
            </button>
            <input #fileInput type="file" hidden (change)="onFileSelected($event)">
            <span *ngIf="selectedFile" class="file-name">{{ selectedFile.name }}</span>
          </div>

          <div class="form-section actions-row">
            <button mat-flat-button class="gold-btn send-btn" (click)="send()" [disabled]="sending || !canSend()">
              <mat-icon>send</mat-icon>
              {{ sending ? 'Sending...' : 'Send' }}
            </button>
            <button mat-stroked-button (click)="router.navigate(['/whatsapp'])">Cancel</button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 800px; margin: 0 auto; }
    .page-title { font-size: 28px; font-weight: 600; color: #333; margin-bottom: 20px; }
    .compose-card { border-radius: 12px; }
    .form-section { margin-bottom: 24px; }
    .section-label { display: block; font-weight: 500; color: #555; margin-bottom: 8px; }
    .radio-group { display: flex; gap: 24px; }
    .full-width { width: 100%; }
    .full-width-table { width: 100%; }
    .table-responsive { overflow-x: auto; max-height: 300px; overflow-y: auto; }
    .recipients-table { margin-top: 8px; }
    .gold-btn { background-color: #D4A843 !important; color: #fff !important; }
    .send-btn { min-width: 140px; }
    .actions-row { display: flex; gap: 12px; align-items: center; }
    .file-name { margin-left: 12px; color: #666; font-size: 14px; }
    .loading-wrapper-small { display: flex; justify-content: center; padding: 16px 0; }
  `]
})
export class WhatsappComposeComponent implements OnInit {
  recipientType: 'CLASS' | 'INDIVIDUAL' = 'CLASS';
  selectedClassId = '';
  classes: SchoolClass[] = [];
  recipients: WhatsAppRecipientInfo[] = [];
  messageBody = '';
  selectedFile: File | null = null;
  sending = false;
  previewLoading = false;

  constructor(
    private api: ApiService,
    public router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe({
      next: (res) => this.classes = res.data || [],
      error: () => {}
    });
  }

  previewRecipients(): void {
    if (!this.selectedClassId) return;
    this.previewLoading = true;
    this.api.resolveWhatsAppRecipients('CLASS', this.selectedClassId).subscribe({
      next: (res) => { this.recipients = res.data || []; this.previewLoading = false; },
      error: () => { this.recipients = []; this.previewLoading = false; }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  canSend(): boolean {
    if (!this.messageBody.trim()) return false;
    if (this.recipientType === 'CLASS' && !this.selectedClassId) return false;
    return true;
  }

  send(): void {
    if (!this.canSend()) return;
    this.sending = true;

    const request: SendWhatsAppRequest = {
      recipientType: this.recipientType,
      messageBody: this.messageBody,
    };
    if (this.recipientType === 'CLASS') {
      request.classId = this.selectedClassId;
    }

    if (this.selectedFile) {
      this.api.uploadWhatsAppMedia(this.selectedFile).subscribe({
        next: (uploadRes) => {
          request.mediaUrl = uploadRes.data.url;
          request.mediaFileName = uploadRes.data.fileName;
          request.mediaMimeType = uploadRes.data.mimeType;
          this.doSend(request);
        },
        error: () => {
          this.snackBar.open('Failed to upload file.', 'Close', { duration: 4000 });
          this.sending = false;
        }
      });
    } else {
      this.doSend(request);
    }
  }

  private doSend(request: SendWhatsAppRequest): void {
    this.api.sendWhatsAppMessage(request).subscribe({
      next: () => {
        this.snackBar.open('Message sent successfully!', 'Close', { duration: 3000 });
        this.router.navigate(['/whatsapp']);
      },
      error: () => {
        this.snackBar.open('Failed to send message.', 'Close', { duration: 4000 });
        this.sending = false;
      }
    });
  }
}
