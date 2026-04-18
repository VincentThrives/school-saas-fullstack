import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { UserRole, FeatureKey, User, AcademicYear } from '../../core/models';

interface MenuItem {
  title: string;
  path: string;
  icon: string;
  roles?: UserRole[];
  feature?: FeatureKey;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() navItemClicked = new EventEmitter<void>();

  menuItems: MenuItem[] = [];
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId = '';
  isLoadingAY = false;
  user: User | null = null;
  attendanceMode = 'DAY_WISE';

  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.user = user;
        this.buildMenu();
      });

    if (!this.authService.isSuperAdmin) {
      this.loadAcademicYears();
      this.apiService.getAttendanceMode()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.attendanceMode = res.data?.mode || 'DAY_WISE';
            this.buildMenu();
          },
          error: () => {
            this.attendanceMode = 'DAY_WISE';
          },
        });
    }

    this.buildMenu();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin;
  }

  get schoolName(): string {
    if (this.isSuperAdmin) return 'Super Admin';
    return this.authService.currentSchoolInfo?.schoolName || 'School';
  }

  get schoolSubtitle(): string {
    return this.isSuperAdmin ? 'SaaS Management' : 'Management System';
  }

  get schoolInitial(): string {
    if (this.isSuperAdmin) return 'SA';
    return this.authService.currentSchoolInfo?.schoolName?.charAt(0) || 'S';
  }

  get schoolLogoUrl(): string | undefined {
    if (this.isSuperAdmin) return undefined;
    return this.authService.currentSchoolInfo?.logoUrl;
  }

  get userInitial(): string {
    return this.user?.firstName?.charAt(0) || 'U';
  }

  get userName(): string {
    if (!this.user) return 'User';
    return `${this.user.firstName} ${this.user.lastName}`;
  }

  get roleDisplay(): string {
    const role = this.authService.currentRole;
    return role ? role.replace('_', ' ') : '';
  }

  get selectedYearIsCurrent(): boolean {
    const year = this.academicYears.find((ay) => ay.academicYearId === this.selectedAcademicYearId);
    return year?.current || false;
  }

  onNavClick(): void {
    this.navItemClicked.emit();
  }

  onAcademicYearChange(yearId: string): void {
    this.selectedAcademicYearId = yearId;
  }

  private loadAcademicYears(): void {
    this.isLoadingAY = true;
    this.apiService.getAcademicYears()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.academicYears = res.data;
            if (!this.selectedAcademicYearId && this.academicYears.length > 0) {
              const current = this.academicYears.find((ay) => ay.current);
              this.selectedAcademicYearId = current
                ? current.academicYearId
                : this.academicYears[0].academicYearId;
            }
          }
          this.isLoadingAY = false;
        },
        error: () => {
          this.isLoadingAY = false;
        },
      });
  }

  private buildMenu(): void {
    const role = this.authService.currentRole;
    const isSuperAdmin = this.authService.isSuperAdmin;

    if (isSuperAdmin) {
      this.menuItems = [
        { title: 'Dashboard', path: '/superadmin/dashboard', icon: 'dashboard' },
        { title: 'Tenants', path: '/superadmin/tenants', icon: 'business' },
        { title: 'Feature Management', path: '/superadmin/features', icon: 'toggle_on' },
        { title: 'Templates', path: '/superadmin/templates', icon: 'bookmark' },
        { title: 'Audit Logs', path: '/superadmin/audit-logs', icon: 'description' },
        { title: 'Settings', path: '/superadmin/settings', icon: 'settings' },
      ];
      return;
    }

    const items: MenuItem[] = [
      { title: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    ];

    if (role === UserRole.SCHOOL_ADMIN || role === UserRole.PRINCIPAL) {
      items.push(
        { title: 'Users', path: '/users', icon: 'people', roles: [UserRole.SCHOOL_ADMIN] },
        { title: 'Students', path: '/students', icon: 'school', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
        { title: 'Bulk Promote', path: '/students/bulk-promote', icon: 'arrow_upward', roles: [UserRole.SCHOOL_ADMIN] },
        { title: 'Employees', path: '/employees', icon: 'badge', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
        { title: 'Classes', path: '/classes', icon: 'class', roles: [UserRole.SCHOOL_ADMIN] },
        { title: 'Subjects', path: '/subjects', icon: 'menu_book', roles: [UserRole.SCHOOL_ADMIN] },
        { title: 'Academic Years', path: '/academic-years', icon: 'date_range', roles: [UserRole.SCHOOL_ADMIN] },
        { title: 'Mark Attendance', path: '/attendance', icon: 'event_note', feature: 'attendance' },
        { title: 'Subject Attendance', path: '/attendance/subject-wise', icon: 'menu_book', feature: 'attendance' },
        { title: 'Attendance Report', path: '/attendance/report', icon: 'assessment', feature: 'attendance' },
        { title: 'Subject Report', path: '/attendance/subject-report', icon: 'analytics', feature: 'attendance' },
        { title: 'Timetable', path: '/timetable', icon: 'calendar_month', feature: 'timetable' },
        { title: 'Exams', path: '/exams', icon: 'assignment', feature: 'exams' },
        { title: 'Exam Calendar', path: '/exams/calendar', icon: 'calendar_month', feature: 'exams' },
        { title: 'Exam Types', path: '/exam-types', icon: 'category', feature: 'exams', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
        { title: 'MCQ Exams', path: '/mcq', icon: 'quiz', feature: 'mcq' },
        { title: 'Fee Structure', path: '/fees', icon: 'payment', feature: 'fee', roles: [UserRole.SCHOOL_ADMIN] },
        { title: 'Fee Payments', path: '/fees/payments', icon: 'receipt_long', feature: 'fee', roles: [UserRole.SCHOOL_ADMIN] },
        { title: 'Events', path: '/events', icon: 'event', feature: 'events' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications' },
        // { title: 'WhatsApp', path: '/whatsapp', icon: 'chat', feature: 'whatsapp' },
        // { title: 'ID Cards', path: '/id-cards', icon: 'badge', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
        { title: 'Report Cards', path: '/report-cards', icon: 'description', feature: 'report_cards' },
        { title: 'Syllabus Tracker', path: '/syllabus', icon: 'menu_book' },
        // { title: 'Assignments', path: '/assignments', icon: 'assignment_turned_in' },
        { title: 'Analytics', path: '/analytics', icon: 'analytics', feature: 'analytics' },
        { title: 'Class Rankings', path: '/analytics/rankings', icon: 'leaderboard', feature: 'analytics' },
      //   { title: 'PTM', path: '/ptm', icon: 'groups' },
        { title: 'Reports', path: '/reports', icon: 'summarize', feature: 'analytics', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
        // { title: 'Settings', path: '/settings', icon: 'settings', roles: [UserRole.SCHOOL_ADMIN] },
      );
    }

    if (role === UserRole.TEACHER) {
      items.push(
        // { title: 'My Classes', path: '/my-classes', icon: 'class' },
        { title: 'My Students', path: '/my-students', icon: 'school' },
        { title: 'Mark Attendance', path: '/attendance', icon: 'event_note', feature: 'attendance' },
        { title: 'Subject Attendance', path: '/attendance/subject-wise', icon: 'menu_book', feature: 'attendance' },
        { title: 'Attendance Report', path: '/attendance/report', icon: 'assessment', feature: 'attendance' },
        { title: 'Subject Report', path: '/attendance/subject-report', icon: 'analytics', feature: 'attendance' },
        { title: 'Events & Holidays', path: '/events', icon: 'event', feature: 'events' },
        { title: 'My Timetable', path: '/my-timetable', icon: 'calendar_month', feature: 'timetable' },
        { title: 'Exams', path: '/exams', icon: 'assignment', feature: 'exams' },
        { title: 'Exam Calendar', path: '/exams/calendar', icon: 'calendar_month', feature: 'exams' },
        // { title: 'MCQ Exams', path: '/mcq', icon: 'quiz', feature: 'mcq' },
        { title: 'Syllabus Tracker', path: '/syllabus', icon: 'menu_book' },
        { title: 'Assignments', path: '/assignments', icon: 'assignment_turned_in' },
        { title: 'Report Cards', path: '/report-cards', icon: 'description', feature: 'report_cards' },
        { title: 'Analytics', path: '/analytics', icon: 'analytics', feature: 'analytics' },
        { title: 'PTM', path: '/ptm', icon: 'groups' },
        // { title: 'Study Materials', path: '/study-materials', icon: 'library_books', feature: 'content' },
        // { title: 'Mentoring Notes', path: '/mentoring', icon: 'note' },
        // { title: 'Messages', path: '/messages', icon: 'message', feature: 'messaging' },
        // { title: 'WhatsApp', path: '/whatsapp', icon: 'chat', feature: 'whatsapp' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications' },
      );
    }

    if (role === UserRole.STUDENT) {
      items.push(
        { title: 'My Timetable', path: '/timetable', icon: 'calendar_month', feature: 'timetable' },
        { title: 'My Attendance', path: '/my-attendance', icon: 'event_note', feature: 'attendance' },
        { title: 'My Marks', path: '/my-marks', icon: 'assignment', feature: 'exams' },
        { title: 'MCQ Exams', path: '/mcq/available', icon: 'quiz', feature: 'mcq' },
        { title: 'Assignments', path: '/assignments', icon: 'assignment_turned_in' },
        { title: 'Report Cards', path: '/report-cards', icon: 'description', feature: 'report_cards' },
        // { title: 'My Analytics', path: '/analytics', icon: 'analytics', feature: 'analytics' },
        { title: 'Study Materials', path: '/study-materials', icon: 'library_books', feature: 'content' },
        { title: 'Events', path: '/events', icon: 'event', feature: 'events' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications' },
        { title: 'Messages', path: '/messages', icon: 'message', feature: 'messaging' },
      );
    }

    if (role === UserRole.PARENT) {
      items.push(
        { title: 'My Children', path: '/children', icon: 'family_restroom' },
        { title: 'Attendance', path: '/child-attendance', icon: 'event_note', feature: 'attendance' },
        { title: 'Marks', path: '/child-marks', icon: 'assignment', feature: 'exams' },
        { title: 'Report Cards', path: '/report-cards', icon: 'description', feature: 'report_cards' },
        { title: 'Assignments', path: '/assignments', icon: 'assignment_turned_in' },
        { title: 'Analytics', path: '/analytics', icon: 'analytics', feature: 'analytics' },
        { title: 'PTM', path: '/ptm', icon: 'groups' },
        { title: 'Fee Status', path: '/fee-status', icon: 'payment', feature: 'fee' },
        { title: 'Events', path: '/events', icon: 'event', feature: 'events' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications' },
        { title: 'Messages', path: '/messages', icon: 'message', feature: 'messaging' },
      );
    }

    this.menuItems = items.filter((item) => this.isItemVisible(item));
  }

  private isItemVisible(item: MenuItem): boolean {
    const role = this.authService.currentRole;
    if (item.roles && role && !item.roles.includes(role)) {
      return false;
    }
    if (item.feature && !this.authService.isSuperAdmin && !this.authService.isFeatureEnabled(item.feature)) {
      return false;
    }
    // Attendance mode visibility:
    // SUBJECT_WISE → show only Subject Attendance + Subject Report
    // DAY_WISE → show only Mark Attendance + Attendance Report
    if (this.attendanceMode === 'SUBJECT_WISE') {
      // Hide day-wise items
      if (item.path === '/attendance' || item.path === '/attendance/report') {
        return false;
      }
    } else {
      // Hide subject-wise items
      if (item.path === '/attendance/subject-wise' || item.path === '/attendance/subject-report') {
        return false;
      }
    }
    return true;
  }
}
