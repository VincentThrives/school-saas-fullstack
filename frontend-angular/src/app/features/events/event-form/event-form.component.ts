import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { scrollToFirstInvalid } from '../../../shared/utils/form-scroll';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent implements OnInit {
  eventForm!: FormGroup;
  isEditing = false;
  eventId: string | null = null;
  isLoading = false;
  isSaving = false;

  eventTypes = [
    { value: 'CULTURAL', label: 'Cultural' },
    { value: 'SPORTS', label: 'Sports' },
    { value: 'ACADEMIC', label: 'Academic' },
    { value: 'HOLIDAY', label: 'Holiday' },
    { value: 'MEETING', label: 'Meeting' },
    { value: 'OTHER', label: 'Other' },
  ];

  recurrencePatterns = [
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'YEARLY', label: 'Yearly' },
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private hostEl: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('eventId');
    this.isEditing = !!this.eventId;

    const isHoliday = this.route.snapshot.queryParamMap.get('holiday') === 'true';

    this.eventForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      type: [isHoliday ? 'HOLIDAY' : 'CULTURAL', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      isHoliday: [isHoliday],
      isRecurring: [false],
      recurrencePattern: [''],
    });

    // Auto-check isHoliday when type changes to HOLIDAY
    this.eventForm.get('type')?.valueChanges.subscribe(type => {
      if (type === 'HOLIDAY') {
        this.eventForm.patchValue({ isHoliday: true });
      }
    });

    if (this.isEditing) {
      this.loadEventData();
    }
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Event' : 'Add Event';
  }

  loadEventData(): void {
    if (!this.eventId) return;
    this.isLoading = true;

    this.apiService.getEvents().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const event = res.data.find((e: any) => e.eventId === this.eventId);
          if (event) {
            this.eventForm.patchValue({
              title: event.title || '',
              description: event.description || '',
              type: event.type || 'OTHER',
              startDate: event.startDate ? new Date(event.startDate) : '',
              endDate: event.endDate ? new Date(event.endDate) : '',
              isHoliday: event.isHoliday || false,
              isRecurring: event.isRecurring || false,
              recurrencePattern: event.recurrencePattern || '',
            });
          }
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load event data', 'Close', { duration: 3000 });
      },
    });
  }

  onSubmit(): void {
    if (this.eventForm.invalid) {
      scrollToFirstInvalid(this.hostEl, this.eventForm);
      this.snackBar.open('Please fill the highlighted required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData = this.eventForm.value;

    // Format dates to ISO date string (YYYY-MM-DD)
    const payload = {
      ...formData,
      startDate: this.formatDateToISO(formData.startDate),
      endDate: this.formatDateToISO(formData.endDate),
    };

    // Remove recurrencePattern if not recurring
    if (!payload.isRecurring) {
      delete payload.recurrencePattern;
    }

    const request$ = this.isEditing && this.eventId
      ? this.apiService.updateEvent(this.eventId, payload)
      : this.apiService.createEvent(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Event updated successfully' : 'Event created successfully',
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/events']);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save event', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
    });
  }

  private formatDateToISO(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  cancel(): void {
    this.router.navigate(['/events']);
  }
}
