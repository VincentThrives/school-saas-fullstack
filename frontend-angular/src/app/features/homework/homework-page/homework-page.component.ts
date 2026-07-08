import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-homework-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './homework-page.component.html',
  styleUrl: './homework-page.component.scss',
})
export class HomeworkPageComponent implements OnInit {
  /** Currently-selected day. Defaults to today so parents/students land
   *  on "what was assigned today" without having to touch the picker. */
  selectedDate: Date = new Date();

  /** Homework rows for {@link selectedDate}. Empty until the fetch
   *  completes; the loading spinner is driven by isLoading. */
  homework: any[] = [];
  isLoading = false;

  /** Detail popup — same shape as the Notifications inbox popup. */
  opened: any = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  /** Called when the admin picks a new date. Refetches from the server
   *  with the new date filter so the payload stays small. */
  onDateChange(): void {
    this.load();
  }

  load(): void {
    const dateStr = this.formatDate(this.selectedDate);
    this.isLoading = true;
    this.api.getHomeworkNotifications(dateStr).subscribe({
      next: (res) => {
        this.homework = (res?.data as any)?.content || [];
        this.isLoading = false;
      },
      error: () => {
        this.homework = [];
        this.isLoading = false;
      },
    });
  }

  open(h: any): void {
    this.opened = h;
  }

  close(): void {
    this.opened = null;
  }

  formatSentAt(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  /** yyyy-MM-dd in local time — matches what the backend
   *  {@code @DateTimeFormat(iso = ISO.DATE)} parser expects. */
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
