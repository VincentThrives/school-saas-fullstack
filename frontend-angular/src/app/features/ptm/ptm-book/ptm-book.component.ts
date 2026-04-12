import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { PtmMeeting, PtmSlot } from '../../../core/models';

@Component({
  selector: 'app-ptm-book',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    PageHeaderComponent,
  ],
  templateUrl: './ptm-book.component.html',
  styleUrl: './ptm-book.component.scss',
})
export class PtmBookComponent implements OnInit {
  ptmId = '';
  meeting: PtmMeeting | null = null;
  slots: PtmSlot[] = [];
  teachers: { id: string; name: string }[] = [];
  selectedTeacherId = '';
  filteredSlots: PtmSlot[] = [];
  isLoading = false;
  isBooking = false;
  selectedSlot: PtmSlot | null = null;

  // TODO: replace with actual student selection for parent
  studentId = '';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.ptmId = this.route.snapshot.paramMap.get('ptmId') || '';
    if (this.ptmId) {
      this.loadMeeting();
      this.loadSlots();
    }
  }

  loadMeeting(): void {
    this.api.getPtmById(this.ptmId).subscribe({
      next: (res) => {
        this.meeting = res.data;
      },
    });
  }

  loadSlots(): void {
    this.isLoading = true;
    this.api.getPtmSlots(this.ptmId).subscribe({
      next: (res) => {
        this.slots = res.data || [];
        this.extractTeachers();
        this.filterSlots();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private extractTeachers(): void {
    const map = new Map<string, string>();
    this.slots.forEach((s) => {
      if (!map.has(s.teacherId)) {
        map.set(s.teacherId, s.teacherName);
      }
    });
    this.teachers = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    if (this.teachers.length > 0 && !this.selectedTeacherId) {
      this.selectedTeacherId = this.teachers[0].id;
    }
  }

  filterSlots(): void {
    this.filteredSlots = this.selectedTeacherId
      ? this.slots.filter((s) => s.teacherId === this.selectedTeacherId)
      : this.slots;
  }

  selectSlot(slot: PtmSlot): void {
    if (slot.status !== 'AVAILABLE') return;
    this.selectedSlot = slot;
  }

  confirmBooking(): void {
    if (!this.selectedSlot) return;
    this.isBooking = true;
    this.api.bookPtmSlot(this.ptmId, {
      slotId: this.selectedSlot.slotId,
      studentId: this.studentId || 'current-student',
    }).subscribe({
      next: () => {
        this.isBooking = false;
        this.selectedSlot = null;
        this.loadSlots();
      },
      error: () => {
        this.isBooking = false;
      },
    });
  }

  cancelSelection(): void {
    this.selectedSlot = null;
  }

  goBack(): void {
    this.router.navigate(['/ptm']);
  }
}
