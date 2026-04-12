import { Component, Input, Output, EventEmitter, OnInit, Renderer2, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
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
export class HeaderComponent implements OnInit {
  @Input() pageTitle = '';
  @Output() menuToggle = new EventEmitter<void>();

  isDarkMode = false;
  unreadCount = 0;

  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    this.applyTheme();
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
