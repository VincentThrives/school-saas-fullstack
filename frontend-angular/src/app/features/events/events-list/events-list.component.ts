import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SchoolEvent, AcademicYear, UserRole } from '../../../core/models';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.scss',
})
export class EventsListComponent implements OnInit {
  allEvents: SchoolEvent[] = [];
  allHolidays: SchoolEvent[] = [];
  events: SchoolEvent[] = [];
  holidays: SchoolEvent[] = [];
  isLoading = false;
  isLoadingHolidays = false;

  displayedColumns: string[] = ['title', 'type', 'startDate', 'endDate', 'actions'];
  holidayColumns: string[] = ['title', 'startDate', 'endDate', 'actions'];

  deleteDialogOpen = false;
  selectedEvent: SchoolEvent | null = null;

  isAdmin = false;

  // Filters
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  selectedMonth = '';

  months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  typeColors: Record<string, string> = {
    CULTURAL: '#9C27B0',
    SPORTS: '#4CAF50',
    ACADEMIC: '#2196F3',
    HOLIDAY: '#F44336',
    MEETING: '#FF9800',
    OTHER: '#9E9E9E',
  };

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole(UserRole.SCHOOL_ADMIN);

    if (!this.isAdmin) {
      this.displayedColumns = ['title', 'type', 'startDate', 'endDate'];
      this.holidayColumns = ['title', 'startDate', 'endDate'];
    }

    this.loadAcademicYears();
  }

  loadAcademicYears(): void {
    this.apiService.getAcademicYears().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.academicYears = res.data;
          // Auto-select current academic year, then trigger the first backend load.
          const current = this.academicYears.find(y => y.current);
          this.selectedAcademicYearId = current ? current.academicYearId : '';
          this.reload();
        } else {
          this.reload();
        }
      },
      error: () => this.reload(),
    });
  }

  /** Build the query params the backend expects. */
  private buildFilterParams(): { academicYearId?: string; month?: number } {
    const p: { academicYearId?: string; month?: number } = {};
    if (this.selectedAcademicYearId) p.academicYearId = this.selectedAcademicYearId;
    if (this.selectedMonth) p.month = parseInt(this.selectedMonth, 10);
    return p;
  }

  loadEvents(): void {
    this.isLoading = true;
    this.apiService.getEvents(this.buildFilterParams()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          // Events tab: only non-holiday events (backend returns both kinds on /events)
          this.allEvents = res.data.filter((e: any) => !e.isHoliday && e.type !== 'HOLIDAY');
          this.events = [...this.allEvents];
        } else {
          this.allEvents = [];
          this.events = [];
        }
        this.isLoading = false;
      },
      error: () => {
        this.allEvents = [];
        this.events = [];
        this.isLoading = false;
      },
    });
  }

  loadHolidays(): void {
    this.isLoadingHolidays = true;
    this.apiService.getHolidays(this.buildFilterParams()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allHolidays = res.data;
          this.holidays = [...this.allHolidays];
        } else {
          this.allHolidays = [];
          this.holidays = [];
        }
        this.isLoadingHolidays = false;
      },
      error: () => {
        this.allHolidays = [];
        this.holidays = [];
        this.isLoadingHolidays = false;
      },
    });
  }

  onFilterChange(): void {
    this.reload();
  }

  /** Re-fetch both tabs from the backend using the current filter selection. */
  private reload(): void {
    this.loadEvents();
    this.loadHolidays();
  }

  getTypeColor(type: string): string {
    return this.typeColors[type] || '#9E9E9E';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getDay(dateStr: string): string {
    if (!dateStr) return '';
    return String(new Date(dateStr).getDate()).padStart(2, '0');
  }

  getMonth(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en', { month: 'short' }).toUpperCase();
  }

  getYear(dateStr: string): string {
    if (!dateStr) return '';
    return String(new Date(dateStr).getFullYear());
  }

  navigateToAddEvent(): void {
    this.router.navigate(['/events/new']);
  }

  navigateToAddHoliday(): void {
    this.router.navigate(['/events/new'], { queryParams: { holiday: 'true' } });
  }

  editEvent(event: SchoolEvent): void {
    this.router.navigate(['/events', event.eventId, 'edit']);
  }

  confirmDelete(event: SchoolEvent): void {
    this.selectedEvent = event;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.selectedEvent = null;
  }

  deleteEvent(): void {
    if (!this.selectedEvent) return;
    const eventId = this.selectedEvent.eventId;
    this.deleteDialogOpen = false;
    this.selectedEvent = null;

    this.apiService.deleteEvent(eventId).subscribe({
      next: () => {
        this.snackBar.open('Event deleted successfully', 'Close', { duration: 3000 });
        this.loadEvents();
        this.loadHolidays();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete event', 'Close', { duration: 3000 });
      },
    });
  }
}
