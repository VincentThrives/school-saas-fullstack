import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface UpcomingExamRow {
  name: string;
  subjectName: string;
  date: string; // ISO yyyy-mm-dd
}

interface UpcomingEventRow {
  title: string;
  startDate: string;
  type: string;
}

interface ClassFeeRow {
  classId: string;
  className: string;
  studentCount: number;
  pendingStudents: number;
  totalDue: number;
  totalPaid: number;
  totalPending: number;
}

@Component({
  selector: 'app-school-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    StatCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './school-admin-dashboard.component.html',
  styleUrl: './school-admin-dashboard.component.scss',
})
export class SchoolAdminDashboardComponent implements OnInit {
  stats: any = {
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    attendanceTodayPercent: 0,
  };
  isLoadingStats = false;

  upcomingExams: UpcomingExamRow[] = [];
  isLoadingExams = false;

  upcomingEvents: UpcomingEventRow[] = [];
  isLoadingEvents = false;

  feesByClass: ClassFeeRow[] = [];
  isLoadingFees = false;

  /** Current academic year scoping the dashboard data. */
  currentYearId = '';
  currentYearLabel = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    // Resolve current academic year first so every widget is year-scoped.
    this.apiService.getAcademicYears().subscribe({
      next: (res) => {
        const list = res?.data || [];
        const current = list.find((y: any) => y.current) || list[0];
        if (current) {
          this.currentYearId = current.academicYearId;
          this.currentYearLabel = current.label || '';
        }
        this.loadStats();
        this.loadUpcomingExams();
        this.loadUpcomingEvents();
        this.loadFeesByClass();
      },
      error: () => {
        // Even if years fail, still try to load; backend falls back to current year.
        this.loadStats();
        this.loadUpcomingExams();
        this.loadUpcomingEvents();
        this.loadFeesByClass();
      },
    });
  }

  // ── Class-wise fees ─────────────────────────────────────────
  private loadFeesByClass(): void {
    this.isLoadingFees = true;
    this.apiService.getFeesByClass(this.currentYearId || undefined).subscribe({
      next: (res) => {
        this.feesByClass = (res?.data || []) as ClassFeeRow[];
        this.isLoadingFees = false;
      },
      error: () => {
        this.feesByClass = [];
        this.isLoadingFees = false;
      },
    });
  }

  // ── Footer totals (computed from feesByClass for the table footer row) ──
  get totalStudents(): number {
    return this.feesByClass.reduce((sum, r) => sum + (r.studentCount || 0), 0);
  }
  get totalPendingStudents(): number {
    return this.feesByClass.reduce((sum, r) => sum + (r.pendingStudents || 0), 0);
  }
  get totalDueAll(): number {
    return this.feesByClass.reduce((sum, r) => sum + (r.totalDue || 0), 0);
  }
  get totalPaidAll(): number {
    return this.feesByClass.reduce((sum, r) => sum + (r.totalPaid || 0), 0);
  }
  get totalPendingAll(): number {
    return this.feesByClass.reduce((sum, r) => sum + (r.totalPending || 0), 0);
  }

  // ── Stat cards ──────────────────────────────────────────────
  private loadStats(): void {
    this.isLoadingStats = true;
    this.apiService.getDashboard(this.currentYearId || undefined).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          // Backend DTO uses attendanceTodayPercent (camel case); template reads both keys safely.
          this.stats = { ...this.stats, ...res.data };
        }
        this.isLoadingStats = false;
      },
      error: () => {
        this.isLoadingStats = false;
        // Leave zeros in place so the UI shows real state (no hardcoded masking).
      },
    });
  }

  // ── Upcoming Exams (live from /api/v1/exams) ──────────────────
  private loadUpcomingExams(): void {
    this.isLoadingExams = true;
    this.apiService.getExams().subscribe({
      next: (res) => {
        let all: any[] = res?.data || [];
        // Restrict to the current academic year if we know it.
        if (this.currentYearId) {
          all = all.filter((e: any) => e.academicYearId === this.currentYearId);
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.upcomingExams = all
          .filter((e) => e?.examDate && new Date(e.examDate) >= today)
          .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime())
          .slice(0, 5)
          .map((e) => ({
            name: e.name || e.examType || 'Exam',
            subjectName: e.subjectName || e.subjectId || '—',
            date: e.examDate,
          }));
        this.isLoadingExams = false;
      },
      error: () => {
        this.upcomingExams = [];
        this.isLoadingExams = false;
      },
    });
  }

  // ── Upcoming Events (live from /api/v1/events) ────────────────
  private loadUpcomingEvents(): void {
    this.isLoadingEvents = true;
    const params = this.currentYearId ? { academicYearId: this.currentYearId } : undefined;
    this.apiService.getEvents(params).subscribe({
      next: (res) => {
        const all: any[] = res?.data || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.upcomingEvents = all
          .filter((e) => e?.startDate && new Date(e.startDate) >= today)
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .slice(0, 5)
          .map((e) => ({
            title: e.title || 'Event',
            startDate: e.startDate,
            type: e.type || 'OTHER',
          }));
        this.isLoadingEvents = false;
      },
      error: () => {
        this.upcomingEvents = [];
        this.isLoadingEvents = false;
      },
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  /** ₹ formatter — Indian grouping (1,23,456) with no decimals when round. */
  formatMoney(amount: number): string {
    const n = Number(amount) || 0;
    const hasFraction = Math.round(n) !== n;
    return '₹' + n.toLocaleString('en-IN', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }
}
