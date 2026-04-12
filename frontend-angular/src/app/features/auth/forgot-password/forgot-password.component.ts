import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  email = '';
  isLoading = false;
  isSuccess = false;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  onSubmit(): void {
    if (!this.email.trim() || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.http
      .post('/api/v1/auth/forgot-password', { email: this.email.trim() })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.isSuccess = true;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage =
            err?.error?.message || 'Failed to send reset email. Please try again.';
        },
      });
  }
}
