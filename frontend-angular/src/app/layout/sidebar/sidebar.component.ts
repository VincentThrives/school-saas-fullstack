import { Component, Output, EventEmitter, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
import { TenantFeatureService } from '../../core/services/tenant-feature.service';
import { UserRole, FeatureKey, CoordinatorModuleKey, User, AcademicYear } from '../../core/models';

interface MenuItem {
  title: string;
  /** Required for leaf items. Group-only entries leave it as ''. */
  path: string;
  icon: string;
  roles?: UserRole[];
  feature?: FeatureKey;
  /**
   * Maps this menu item to one of the tenant's toggleable
   * Coordinator Access modules. When the logged-in user is a
   * SCHOOL_COORDINATOR, only items whose {@code coordinatorModule}
   * appears in the tenant's enabled list are shown. Items without
   * a {@code coordinatorModule} (e.g. Manage Users, Coordinator
   * Access page, /users) are admin-only and hidden from
   * coordinators regardless of the tenant config.
   *
   * <p>For SCHOOL_ADMIN/PRINCIPAL/TEACHER/STUDENT/PARENT this field
   * has no effect — they keep seeing whatever their existing role
   * and feature rules allow.</p>
   */
  coordinatorModule?: CoordinatorModuleKey;
  /** When set, this item is rendered as an expandable group (accordion).
   *  Children themselves can be plain leaves; nested groups are not supported. */
  children?: MenuItem[];
  /** Internal state — toggled on click; auto-set true if a child path is active. */
  expanded?: boolean;
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

  /** Tenant's currently-enabled module keys for the
   *  SCHOOL_COORDINATOR role. Loaded on init when the logged-in user
   *  IS a SCHOOL_COORDINATOR; ignored for every other role.
   *  {@code null} = "no restrictions yet" → render the full admin
   *  menu (safe default for freshly-promoted coordinators). */
  private coordinatorEnabledModules: Set<string> | null = null;

  /** Current URL path without query/fragment. Updated on every NavigationEnd
   *  so {@link isItemActive} can pick the most-specific matching item. */
  private currentUrl = '';

  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    public features: TenantFeatureService,
  ) {
    // Rebuild the menu whenever the SMS flag flips. app.component.ts
    // fetches /users/me asynchronously, so the SMS flag may land AFTER
    // the user observable has already fired buildMenu once with the
    // default `smsEnabled = false`. Without this effect the SMS group
    // would stay hidden until the next manual refresh — the
    // "SMS sidenav missing sometimes" race the user reported.
    effect(() => {
      this.features.smsEnabled();
      this.buildMenu();
    });
  }

  ngOnInit(): void {
    // Seed and track the current URL so the active-item logic can pick
    // the most-specific match (instead of letting Angular's default
    // routerLinkActive light up every prefix sibling).
    this.currentUrl = this.stripQuery(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(e => { this.currentUrl = this.stripQuery(e.urlAfterRedirects || e.url); });

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

      // SCHOOL_COORDINATOR needs the tenant's enabled-modules list
      // so the sidenav filter can hide locked-down items. Other
      // roles ignore this — fetching only for coordinators keeps
      // the central-DB read off the critical path for every
      // admin/teacher/student login.
      if (this.authService.currentRole === UserRole.SCHOOL_COORDINATOR) {
        this.apiService.getCoordinatorAccess()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              const enabled = res?.data?.enabledModules || [];
              this.coordinatorEnabledModules = new Set<string>(enabled);
              this.buildMenu();
            },
            error: () => {
              // Failure → fall back to "no restrictions" so a
              // coordinator isn't locked out of the entire app by a
              // transient central-DB hiccup. The route-level guard
              // still enforces access at navigation time.
              this.coordinatorEnabledModules = null;
            },
          });
      }
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
        { title: 'SMS Control', path: '/superadmin/sms', icon: 'sms' },
        { title: 'Templates', path: '/superadmin/templates', icon: 'bookmark' },
        { title: 'Audit Logs', path: '/superadmin/audit-logs', icon: 'description' },
        { title: 'Settings', path: '/superadmin/settings', icon: 'settings' },
      ];
      return;
    }

    const items: MenuItem[] = [
      { title: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    ];

    if (role === UserRole.SCHOOL_ADMIN || role === UserRole.PRINCIPAL || role === UserRole.SCHOOL_COORDINATOR) {
      items.push(
        // ── Manage Users group ──
        {
          title: 'Manage Users', path: '', icon: 'manage_accounts',
          children: [
            { title: 'Students', path: '/students', icon: 'school', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'STUDENTS' },
            { title: 'Bulk Promote', path: '/students/bulk-promote', icon: 'arrow_upward', roles: [UserRole.SCHOOL_ADMIN] },
            { title: 'Users', path: '/users', icon: 'people', roles: [UserRole.SCHOOL_ADMIN] },
            { title: 'Employees', path: '/employees', icon: 'badge', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'TEACHERS' },
            // Coordinator Access config — admin/principal only.
            // Lives under Manage Users since it's a permissions
            // surface; coordinators can never see this page (no
            // coordinatorModule annotation).
            { title: 'Coordinator Access', path: '/coordinator-access', icon: 'shield_person', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
          ],
        },
        // ── Configuration group ──
        {
          title: 'Configuration', path: '', icon: 'settings',
          children: [
            { title: 'Academic Years', path: '/academic-years', icon: 'date_range', roles: [UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'ACADEMIC_YEARS' },
            { title: 'Subjects', path: '/subjects', icon: 'menu_book', roles: [UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'SUBJECTS' },
            { title: 'Classes', path: '/classes', icon: 'class', roles: [UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'CLASSES' },
            { title: 'Teacher Assignments', path: '/teacher-assignments', icon: 'assignment_ind', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'TEACHERS' },
          ],
        },
        // ── Attendance group ──
        {
          title: 'Attendance', path: '', icon: 'event_note',
          children: [
            { title: 'Mark Attendance', path: '/attendance', icon: 'event_note', feature: 'attendance', coordinatorModule: 'ATTENDANCE' },
            { title: 'Subject Attendance', path: '/attendance/subject-wise', icon: 'menu_book', feature: 'attendance', coordinatorModule: 'ATTENDANCE' },
            { title: 'Attendance Report', path: '/attendance/report', icon: 'assessment', feature: 'attendance', coordinatorModule: 'ATTENDANCE' },
            { title: 'Subject Report', path: '/attendance/subject-report', icon: 'analytics', feature: 'attendance', coordinatorModule: 'ATTENDANCE' },
          ],
        },
        { title: 'Timetable', path: '/timetable', icon: 'calendar_month', feature: 'timetable', coordinatorModule: 'TIMETABLE' },
        // ── Exams group ──
        {
          title: 'Exams', path: '', icon: 'assignment',
          children: [

            // Bulk-create entry — admin picks exam type + class/sections +
            // subjects and the backend fans out into many Exam docs in one
            // save. Lives next to the regular Exams list. Admin-only.
            { title: 'Exam Config', path: '/exams/config', icon: 'playlist_add_check', feature: 'exams', roles: [UserRole.SCHOOL_ADMIN] },
            { title: 'Exams', path: '/exams', icon: 'assignment', feature: 'exams', coordinatorModule: 'EXAMS' },
            { title: 'Exam Calendar', path: '/exams/calendar', icon: 'calendar_month', feature: 'exams', coordinatorModule: 'EXAMS' },
            { title: 'Exam Types', path: '/exam-types', icon: 'category', feature: 'exams', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
            // { title: 'MCQ Exams', path: '/mcq', icon: 'quiz', feature: 'mcq' },
          ],
        },
        // ── Fees group ──
        {
          title: 'Fees', path: '', icon: 'payment',
          children: [
            { title: 'Fee Structure', path: '/fees', icon: 'payment', feature: 'fee', roles: [UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'FEES' },
            { title: 'Fee Payments', path: '/fees/payments', icon: 'receipt_long', feature: 'fee', roles: [UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_COORDINATOR], coordinatorModule: 'FEES' },
          ],
        },
        { title: 'Events', path: '/events', icon: 'event', feature: 'events', coordinatorModule: 'EVENTS' },
        { title: 'Homework', path: '/homework', icon: 'menu_book', feature: 'notifications', coordinatorModule: 'NOTIFICATIONS' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications', coordinatorModule: 'NOTIFICATIONS' },
        // SMS — only visible when Super Admin has enabled SMS for this
        // tenant. TenantFeatureService.smsEnabled() is a signal that
        // re-evaluates on every change-detection pass, so the menu item
        // appears/disappears within seconds of a toggle (plus a page
        // reload). The smsFeatureGuard re-enforces this at route entry
        // as defence in depth.
        //
        // Two-child group: the main /settings/sms view + the dedicated
        // audit log page. Splitting them lets the audit log page filter
        // by year/template/status/date without bloating the main view.
        ...(this.features.smsEnabled() ? [
          {
            title: 'SMS', path: '', icon: 'sms',
            children: [
              { title: 'SMS Notifications', path: '/settings/sms', icon: 'sms', coordinatorModule: 'SMS' as CoordinatorModuleKey },
              { title: 'SMS Audit Log', path: '/settings/sms/audit-log', icon: 'history', coordinatorModule: 'SMS' as CoordinatorModuleKey },
            ],
          } as MenuItem,
        ] : []),
        // { title: 'WhatsApp', path: '/whatsapp', icon: 'chat', feature: 'whatsapp' },
        // { title: 'ID Cards', path: '/id-cards', icon: 'badge', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
        { title: 'Syllabus Tracker', path: '/syllabus', icon: 'menu_book', feature: 'syllabus', coordinatorModule: 'SUBJECTS' },
        // { title: 'Assignments', path: '/assignments', icon: 'assignment_turned_in' },
        // { title: 'Analytics', path: '/analytics', icon: 'analytics', feature: 'analytics' },
        // ── Results group ──
        {
          title: 'Results', path: '', icon: 'leaderboard',
          children: [
            { title: 'Class Rankings', path: '/analytics/rankings', icon: 'leaderboard', feature: 'analytics', coordinatorModule: 'EXAMS' },
            // { title: 'Reports', path: '/reports', icon: 'summarize', feature: 'analytics', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
            { title: 'Report Cards', path: '/report-cards', icon: 'description', feature: 'report_cards', coordinatorModule: 'REPORT_CARDS' },
          ],
        },
        //   { title: 'PTM', path: '/ptm', icon: 'groups' },
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
        { title: 'Syllabus Tracker', path: '/syllabus', icon: 'menu_book', feature: 'syllabus' },
        // { title: 'Assignments', path: '/assignments', icon: 'assignment_turned_in' },
        { title: 'Report Cards', path: '/report-cards', icon: 'description', feature: 'report_cards' },
        // { title: 'Analytics', path: '/analytics', icon: 'analytics', feature: 'analytics' },
        { title: 'Class Rankings', path: '/analytics/rankings', icon: 'leaderboard', feature: 'analytics' },
        // { title: 'PTM', path: '/ptm', icon: 'groups' },
        // { title: 'Study Materials', path: '/study-materials', icon: 'library_books', feature: 'content' },
        // { title: 'Mentoring Notes', path: '/mentoring', icon: 'note' },
        // { title: 'Messages', path: '/messages', icon: 'message', feature: 'messaging' },
        // { title: 'WhatsApp', path: '/whatsapp', icon: 'chat', feature: 'whatsapp' },
        { title: 'Homework', path: '/homework', icon: 'menu_book', feature: 'notifications' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications' },
      );
    }

    if (role === UserRole.STUDENT) {
      items.push(
        { title: 'My Timetable', path: '/timetable', icon: 'calendar_month', feature: 'timetable' },
        { title: 'My Attendance', path: '/my-attendance', icon: 'event_note', feature: 'attendance' },
        { title: 'My Marks', path: '/my-marks', icon: 'assignment', feature: 'exams' },
        // { title: 'MCQ Exams', path: '/mcq/available', icon: 'quiz', feature: 'mcq' },
        // { title: 'Assignments', path: '/assignments', icon: 'assignment_turned_in' },
        { title: 'My Report Card', path: '/my-report-card', icon: 'description', feature: 'report_cards' },
        // { title: 'My Analytics', path: '/analytics', icon: 'analytics', feature: 'analytics' },
        // { title: 'Study Materials', path: '/study-materials', icon: 'library_books', feature: 'content' },
        { title: 'Events', path: '/events', icon: 'event', feature: 'events' },
        { title: 'Homework', path: '/homework', icon: 'menu_book', feature: 'notifications' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications' },
        // { title: 'Fee Status', path: '/fee-status', icon: 'payment', feature: 'fee' },
        // { title: 'Messages', path: '/messages', icon: 'message', feature: 'messaging' },
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
        { title: 'Homework', path: '/homework', icon: 'menu_book', feature: 'notifications' },
        { title: 'Notifications', path: '/notifications', icon: 'notifications', feature: 'notifications' },
        // { title: 'Messages', path: '/messages', icon: 'message', feature: 'messaging' },
      );
    }

    // "My Profile" sits at the bottom of every tenant-side sidebar — common
    // anchor across roles since it's about the logged-in user, not features.
    // The /profile route renders a role-aware shell (student/employee/admin).
    items.push({ title: 'My Profile', path: '/profile', icon: 'person' });

    this.menuItems = items.filter((item) => this.isItemVisible(item));
  }

  /** Public so the template can hide accordion children based on the same
   *  role + feature + attendance-mode rules used to filter top-level items. */
  isItemVisible(item: MenuItem): boolean {
    const role = this.authService.currentRole;
    if (item.roles && role && !item.roles.includes(role)) {
      return false;
    }
    if (item.feature && !this.authService.isSuperAdmin && !this.authService.isFeatureEnabled(item.feature)) {
      return false;
    }
    // SCHOOL_COORDINATOR filter — leaf items without a
    // coordinatorModule are admin-only and hidden; items with one
    // are visible only when the tenant has the module in its
    // enabled list. Group headers (path === '') are unaffected —
    // hasVisibleChildren handles them.
    //
    // Dashboard + My Profile are universal — every role's entry +
    // identity surface respectively, so they bypass this filter
    // even though they have no coordinatorModule annotation.
    if (role === UserRole.SCHOOL_COORDINATOR
        && item.path
        && item.path !== '/dashboard'
        && item.path !== '/profile') {
      if (!item.coordinatorModule) return false;
      // coordinatorEnabledModules === null means "not loaded yet"
      // or "load failed" → don't pre-hide everything (avoids the
      // sidenav flashing empty on slow networks). The route guard
      // is the real enforcement; this is just the UX surface.
      if (this.coordinatorEnabledModules !== null
          && !this.coordinatorEnabledModules.has(item.coordinatorModule)) {
        return false;
      }
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

  /** True if a group has at least one visible child — drives whether the
   *  group header is rendered at all. */
  hasVisibleChildren(item: MenuItem): boolean {
    return !!item.children && item.children.some(c => this.isItemVisible(c));
  }

  /** Click handler for the accordion header (group with children).
   *  We treat `expanded` as a tristate: `undefined` means "follow the URL"
   *  (auto-open if a child is active), `true`/`false` means "user picked it
   *  and overrides the URL signal". So clicking the header always toggles —
   *  even when the user is sitting on one of the child pages.
   *
   *  Single-open behavior: opening one group collapses every other group, so
   *  only one accordion section is expanded at a time. */
  toggleGroup(item: MenuItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = !this.isGroupOpen(item);
    if (willOpen) {
      // Close every other group (force `false` so URL auto-open doesn't
      // resurrect them while another accordion is the user's pick).
      for (const other of this.menuItems) {
        if (other !== item && other.children) {
          other.expanded = false;
        }
      }
    }
    item.expanded = willOpen;
  }

  /** Whether a group is currently displayed open. Used by both the template
   *  binding and the toggle handler so the two stay consistent. */
  isGroupOpen(item: MenuItem): boolean {
    if (item.expanded === true) return true;
    if (item.expanded === false) return false;
    return this.isGroupActive(item);
  }

  /** Auto-expand a group when one of its children matches the current URL.
   *  Used by `isGroupOpen` as the default when the user hasn't toggled. */
  isGroupActive(item: MenuItem): boolean {
    const current = this.currentUrl || this.router.url;
    return !!item.children && item.children.some(c => c.path && this.urlMatchesPath(current, c.path));
  }

  /**
   * Is this item's path the BEST match for the current URL? "Best" means
   * the longest sidebar path that's either equal to or a string-prefix
   * (with a "/" boundary) of the URL. Replaces Angular's default
   * routerLinkActive prefix-match, which would also light up
   * /exams when the URL is /exams/config.
   */
  isItemActive(item: MenuItem): boolean {
    if (!item?.path) return false;
    const url = this.currentUrl || this.stripQuery(this.router.url);
    if (!this.urlMatchesPath(url, item.path)) return false;

    // Find the most-specific sidebar path that matches this URL across
    // EVERY top-level item (so a leaf at the top level can still beat a
    // group child if it's more specific, and vice versa).
    let bestLen = -1;
    for (const top of this.menuItems) {
      if (top.path && this.urlMatchesPath(url, top.path)) {
        bestLen = Math.max(bestLen, top.path.length);
      }
      for (const child of top.children || []) {
        if (child.path && this.urlMatchesPath(url, child.path)) {
          bestLen = Math.max(bestLen, child.path.length);
        }
      }
    }
    return item.path.length === bestLen;
  }

  /** True when {@code url} is exactly {@code path} OR starts with `path + "/"`.
   *  Trailing slash boundary stops "/exams" from matching "/exams-foo". */
  private urlMatchesPath(url: string, path: string): boolean {
    if (!path) return false;
    if (url === path) return true;
    return url.startsWith(path.endsWith('/') ? path : path + '/');
  }

  private stripQuery(url: string): string {
    if (!url) return '';
    const q = url.indexOf('?');
    const h = url.indexOf('#');
    let end = url.length;
    if (q >= 0) end = Math.min(end, q);
    if (h >= 0) end = Math.min(end, h);
    return url.substring(0, end);
  }
}
