import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  exams: any[];
}

@Component({
  selector: 'app-exam-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './exam-calendar.component.html',
  styleUrl: './exam-calendar.component.scss',
})
export class ExamCalendarComponent implements OnInit {
  exams: any[] = [];
  isLoading = false;

  currentDate = new Date();
  selectedYear: number;
  selectedMonth: number;
  calendarDays: CalendarDay[] = [];
  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  upcomingExams: any[] = [];

  constructor(private api: ApiService) {
    this.selectedYear = this.currentDate.getFullYear();
    this.selectedMonth = this.currentDate.getMonth();
  }

  ngOnInit(): void {
    this.loadExams();
  }

  get monthLabel(): string {
    const date = new Date(this.selectedYear, this.selectedMonth, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  previousMonth(): void {
    if (this.selectedMonth === 0) {
      this.selectedMonth = 11;
      this.selectedYear--;
    } else {
      this.selectedMonth--;
    }
    this.buildCalendar();
  }

  nextMonth(): void {
    if (this.selectedMonth === 11) {
      this.selectedMonth = 0;
      this.selectedYear++;
    } else {
      this.selectedMonth++;
    }
    this.buildCalendar();
  }

  private loadExams(): void {
    this.isLoading = true;
    this.api.getExamCalendar().subscribe({
      next: (res) => {
        this.exams = res.data || [];
        this.buildCalendar();
        this.buildUpcomingList();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private buildCalendar(): void {
    const firstDay = new Date(this.selectedYear, this.selectedMonth, 1);
    const lastDay = new Date(this.selectedYear, this.selectedMonth + 1, 0);
    const today = new Date();

    // Monday = 0 based start
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevMonthLast = new Date(this.selectedYear, this.selectedMonth, 0);
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(prevMonthLast.getFullYear(), prevMonthLast.getMonth(), prevMonthLast.getDate() - i);
      days.push({
        date: d,
        dayOfMonth: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        exams: this.getExamsForDate(d),
      });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(this.selectedYear, this.selectedMonth, day);
      const isToday = d.getDate() === today.getDate()
        && d.getMonth() === today.getMonth()
        && d.getFullYear() === today.getFullYear();
      days.push({
        date: d,
        dayOfMonth: day,
        isCurrentMonth: true,
        isToday: isToday,
        exams: this.getExamsForDate(d),
      });
    }

    // Next month padding to fill 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(this.selectedYear, this.selectedMonth + 1, i);
      days.push({
        date: d,
        dayOfMonth: i,
        isCurrentMonth: false,
        isToday: false,
        exams: this.getExamsForDate(d),
      });
    }

    this.calendarDays = days;
  }

  private getExamsForDate(date: Date): any[] {
    const dateStr = this.formatDate(date);
    return this.exams.filter((e) => {
      const examDate = e.examDate;
      if (!examDate) return false;
      // Handle both ISO string and array formats
      if (typeof examDate === 'string') {
        return examDate.substring(0, 10) === dateStr;
      }
      if (Array.isArray(examDate)) {
        const [y, m, d] = examDate;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` === dateStr;
      }
      return false;
    });
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildUpcomingList(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.upcomingExams = this.exams
      .filter((e) => {
        if (!e.examDate) return false;
        let examDate: Date;
        if (typeof e.examDate === 'string') {
          examDate = new Date(e.examDate);
        } else if (Array.isArray(e.examDate)) {
          const [y, m, d] = e.examDate;
          examDate = new Date(y, m - 1, d);
        } else {
          return false;
        }
        return examDate >= today;
      })
      .slice(0, 10);
  }

  getExamDateDisplay(exam: any): string {
    if (!exam.examDate) return '-';
    if (typeof exam.examDate === 'string') {
      return new Date(exam.examDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (Array.isArray(exam.examDate)) {
      const [y, m, d] = exam.examDate;
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return '-';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'status-scheduled';
      case 'ONGOING': return 'status-ongoing';
      case 'COMPLETED': return 'status-completed';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }
}
