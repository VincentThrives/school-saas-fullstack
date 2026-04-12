import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PtmMeeting, PtmSlot, PtmSlotStatus } from '../../../core/models';

@Component({
  selector: 'app-ptm-schedule',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './ptm-schedule.component.html',
  styleUrl: './ptm-schedule.component.scss',
})
export class PtmScheduleComponent implements OnInit {
  ptmId = '';
  meeting: PtmMeeting | null = null;
  slots: PtmSlot[] = [];
  isLoading = false;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.ptmId = this.route.snapshot.paramMap.get('ptmId') || '';
    if (this.ptmId) {
      this.loadMeeting();
      this.loadSchedule();
    }
  }

  loadMeeting(): void {
    this.api.getPtmById(this.ptmId).subscribe({
      next: (res) => {
        this.meeting = res.data;
      },
    });
  }

  loadSchedule(): void {
    this.isLoading = true;
    this.api.getPtmSlots(this.ptmId).subscribe({
      next: (res) => {
        this.slots = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  getStatusClass(status: PtmSlotStatus): string {
    switch (status) {
      case 'AVAILABLE': return 'status-available';
      case 'BOOKED': return 'status-booked';
      case 'COMPLETED': return 'status-completed';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  isCompleted(slot: PtmSlot): boolean {
    return slot.status === 'COMPLETED';
  }

  markComplete(slot: PtmSlot): void {
    this.api.completePtmSlot(this.ptmId, slot.slotId).subscribe({
      next: () => {
        this.loadSchedule();
      },
    });
  }
}
