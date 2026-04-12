import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-super-admin-login',
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
  ],
  templateUrl: './super-admin-login.component.html',
  styleUrl: './super-admin-login.component.scss',
})
export class SuperAdminLoginComponent {
  username = '';
  password = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService
      .superAdminLogin({
        username: this.username.trim(),
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.router.navigate(['/superadmin/dashboard'], { replaceUrl: true });
          }
        },
        error: (err) => {
          this.isLoading = false;
          if (err?.status === 429) {
            this.errorMessage = 'Too many login attempts. Please wait before trying again.';
          } else {
            this.errorMessage =
              err?.error?.message || 'Invalid credentials.';
          }
        },
      });
  }
}
