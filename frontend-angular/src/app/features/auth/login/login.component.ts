import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { TenantPublicInfo } from '../../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  schoolInfo: TenantPublicInfo | null = null;
  username = '';
  password = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.schoolInfo = this.authService.currentSchoolInfo;
    if (!this.schoolInfo) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  get schoolInitial(): string {
    return this.schoolInfo?.schoolName?.charAt(0) || 'S';
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password || this.isLoading || !this.schoolInfo) return;

    this.isLoading = true;
    this.errorMessage = '';

    // Lowercase the username so "Varun" / "VARUN" / "varun" all hit the same
    // account. Backend lowercases again as defence-in-depth; this also makes
    // the value we send match what the user sees stored on the student card.
    this.authService
      .login({
        tenantId: this.schoolInfo.tenantId,
        username: this.username.trim().toLowerCase(),
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.router.navigate(['/dashboard'], { replaceUrl: true });
          }
        },
        error: (err) => {
          this.isLoading = false;
          const msg = err?.error?.message || '';
          if (msg.includes('locked')) {
            this.errorMessage =
              'Account locked due to multiple failed attempts. Contact your school admin.';
          } else if (err?.status === 500) {
            // The auth interceptor used to mask every 500 as "Unexpected error".
            // Surface a friendlier hint that points to the most common cause —
            // a server side issue an admin can investigate.
            this.errorMessage =
              'Server error while signing in. Please try again in a moment; if it persists, contact your school admin.';
          } else {
            this.errorMessage = msg || 'Incorrect username or password.';
          }
        },
      });
  }

  onBack(): void {
    this.authService.clearTenant();
    this.router.navigate(['/login']);
  }
}
