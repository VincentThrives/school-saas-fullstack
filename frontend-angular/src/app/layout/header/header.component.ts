import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Renderer2, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { NotificationBusService } from '../../core/services/notification-bus.service';
import { User, UserRole } from '../../core/models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() pageTitle = '';
  @Output() menuToggle = new EventEmitter<void>();

  isDarkMode = false;
  unreadCount = 0;

  /** Label shown on the bell badge. "99+" once the real count exceeds 99. */
  get badgeLabel(): string {
    if (this.unreadCount <= 0) return '';
    return this.unreadCount > 99 ? '99+' : String(this.unreadCount);
  }

  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private routerSub?: Subscription;
  private busSub?: Subscription;
  private pollTimer?: any;

  constructor(
    public authService: AuthService,
    private router: Router,
    private api: ApiService,
    private notificationBus: NotificationBusService,
  ) {}

  ngOnInit(): void {
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    this.applyTheme();

    // Super Admin doesn't get in-app notifications — skip.
    if (this.authService.isSuperAdmin) return;

    // Initial fetch so the badge shows up immediately.
    this.refreshUnreadCount();

    // Refresh on every route change — when the user leaves the Notifications
    // page (after reading their inbox), the count re-fetches and the badge
    // drops / disappears if everything's been read.
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.refreshUnreadCount());

    // Poll every 60 s so new incoming notifications bump the badge without a reload.
    this.pollTimer = setInterval(() => this.refreshUnreadCount(), 60_000);

    // Instant refresh: the Inbox emits on this bus after a user clicks a row
    // to mark-as-read, so the badge drops immediately (no 60 s wait).
    this.busSub = this.notificationBus.refresh.subscribe(() => this.refreshUnreadCount());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.busSub?.unsubscribe();
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private refreshUnreadCount(): void {
    // Skip for super admin (no inbox) and when not authenticated.
    if (this.authService.isSuperAdmin || !this.authService.isAuthenticated) {
      this.unreadCount = 0;
      return;
    }
    this.api.getUnreadNotificationCount().subscribe({
      next: (res) => {
        // Backend may return either a raw number or wrapped in ApiResponse.data.
        const raw = (res as any)?.data ?? (res as any);
        const n = Number(raw ?? 0);
        const safe = isNaN(n) ? 0 : n;
        console.debug('[bell] unread count =', safe);
        this.unreadCount = safe;
      },
      error: (err) => {
        console.debug('[bell] unread count fetch failed:', err?.status, err?.message);
      },
    });
  }

  get user(): User | null {
    return this.authService.currentUser;
  }

  get userInitial(): string {
    return this.user?.firstName?.charAt(0) || 'U';
  }

  get userName(): string {
    if (!this.user) return 'User';
    return `${this.user.firstName} ${this.user.lastName}`;
  }

  get userEmail(): string {
    return this.user?.email || '';
  }

  get roleDisplay(): string {
    const role = this.authService.currentRole;
    return role ? role.replace('_', ' ') : '';
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin;
  }

  get schoolName(): string {
    return this.authService.currentSchoolInfo?.schoolName || '';
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', String(this.isDarkMode));
    this.applyTheme();
  }

  private applyTheme(): void {
    if (this.isDarkMode) {
      this.renderer.addClass(this.document.body, 'dark-theme');
    } else {
      this.renderer.removeClass(this.document.body, 'dark-theme');
    }
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  navigateToSettings(): void {
    if (this.isSuperAdmin) {
      this.router.navigate(['/superadmin/settings']);
    } else {
      this.router.navigate(['/settings']);
    }
  }

  navigateToNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  logout(): void {
    this.authService.logout();
  }
}
