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
import { MatCheckboxModule } from '@angular/material/checkbox';
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
    MatCheckboxModule,
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
  /** Remember both username AND password between sessions so parents
   *  can just tap Sign In on the next visit. Password is base64-encoded
   *  (obfuscation, not encryption) in the app's own localStorage —
   *  isolated per-app on Android, same protection level as any WebView
   *  password store. Only saved when the user explicitly ticks
   *  "Remember me" (default ON, but they can uncheck it). */
  rememberMe = true;
  private static readonly REMEMBERED_USERNAME_KEY = 'rememberedUsername';
  private static readonly REMEMBERED_PASSWORD_KEY = 'rememberedPasswordB64';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.schoolInfo = this.authService.currentSchoolInfo;
    if (!this.schoolInfo) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
    // Restore last-saved credentials so the fields are pre-filled and
    // the user just has to tap Sign In. Uses base64 decode on the
    // password side — same encoding used on save.
    const savedUser = localStorage.getItem(LoginComponent.REMEMBERED_USERNAME_KEY);
    const savedPwdB64 = localStorage.getItem(LoginComponent.REMEMBERED_PASSWORD_KEY);
    if (savedUser) {
      this.username = savedUser;
      this.rememberMe = true;
    }
    if (savedPwdB64) {
      try { this.password = atob(savedPwdB64); }
      catch { /* malformed stored value — ignore */ }
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
            // Persist / clear the remembered credentials based on the tick.
            // Password saved as base64 (obfuscation, not encryption) —
            // reasonable trade-off for a family school app where the
            // alternative is retyping every time.
            if (this.rememberMe) {
              localStorage.setItem(
                LoginComponent.REMEMBERED_USERNAME_KEY,
                this.username.trim().toLowerCase());
              localStorage.setItem(
                LoginComponent.REMEMBERED_PASSWORD_KEY,
                btoa(this.password));
            } else {
              localStorage.removeItem(LoginComponent.REMEMBERED_USERNAME_KEY);
              localStorage.removeItem(LoginComponent.REMEMBERED_PASSWORD_KEY);
            }
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
