import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PtmMeeting, UserRole, PtmStatus } from '../../../core/models';

@Component({
  selector: 'app-ptm-list',
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
  templateUrl: './ptm-list.component.html',
  styleUrl: './ptm-list.component.scss',
})
export class PtmListComponent implements OnInit {
  meetings: PtmMeeting[] = [];
  displayedColumns = ['title', 'date', 'time', 'location', 'slots', 'status', 'actions'];
  isLoading = false;

  get isAdmin(): boolean {
    const role = this.authService.currentRole;
    return role === UserRole.SCHOOL_ADMIN || role === UserRole.PRINCIPAL;
  }

  get isTeacher(): boolean {
    return this.authService.currentRole === UserRole.TEACHER;
  }

  get isParent(): boolean {
    return this.authService.currentRole === UserRole.PARENT;
  }

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMeetings();
  }

  loadMeetings(): void {
    this.isLoading = true;
    this.api.getPtmMeetings().subscribe({
      next: (res) => {
        this.meetings = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  getStatusClass(status: PtmStatus): string {
    switch (status) {
      case 'SCHEDULED': return 'status-scheduled';
      case 'ONGOING': return 'status-ongoing';
      case 'COMPLETED': return 'status-completed';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  createPtm(): void {
    this.router.navigate(['/ptm/new']);
  }

  bookSlots(ptmId: string): void {
    this.router.navigate(['/ptm', ptmId, 'book']);
  }

  viewSchedule(ptmId: string): void {
    this.router.navigate(['/ptm', ptmId, 'schedule']);
  }
}
