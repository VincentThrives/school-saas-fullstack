import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-super-admin-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="logo-circle">
          <mat-icon class="shield-icon">admin_panel_settings</mat-icon>
        </div>

        <h1 class="auth-title">Super Admin Portal</h1>
        <p class="auth-subtitle">Sign in with your administrator credentials</p>

        <div class="error-alert" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input
              matInput
              formControlName="username"
              placeholder="admin@schoolsaas.com"
              autocomplete="username"
            />
            <mat-error *ngIf="form.controls['username'].hasError('required')">
              Email is required
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input
              matInput
              [type]="hidePassword ? 'password' : 'text'"
              formControlName="password"
              placeholder="Enter your password"
              autocomplete="current-password"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="hidePassword = !hidePassword"
              [attr.aria-label]="hidePassword ? 'Show password' : 'Hide password'"
            >
              <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error *ngIf="form.controls['password'].hasError('required')">
              Password is required
            </mat-error>
          </mat-form-field>

          <button
            mat-flat-button
            type="submit"
            class="gold-button full-width"
            [disabled]="form.invalid || loading"
          >
            <mat-spinner *ngIf="loading" diameter="20" class="spinner-inline"></mat-spinner>
            <span *ngIf="!loading">Sign In</span>
          </button>
        </form>

        <div class="bottom-link">
          <a routerLink="/login">&larr; Back to School Login</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0D0D0D 0%, #1A1A1A 100%);
      padding: 24px;
    }

    .auth-card {
      background: #FFFFFF;
      border-radius: 16px;
      padding: 48px 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(212, 168, 67, 0.3);
      text-align: center;
    }

    .logo-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #D4A843 0%, #B8860B 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }

    .shield-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #FFFFFF;
    }

    .auth-title {
      font-size: 22px;
      font-weight: 600;
      color: #1A1A1A;
      margin: 0 0 8px;
    }

    .auth-subtitle {
      font-size: 14px;
      color: #666666;
      margin: 0 0 32px;
    }

    .full-width {
      width: 100%;
    }

    .gold-button {
      background: linear-gradient(135deg, #D4A843 0%, #B8860B 100%) !important;
      color: #FFFFFF !important;
      height: 48px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px !important;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gold-button:disabled {
      opacity: 0.6;
    }

    .spinner-inline {
      display: inline-block;
    }

    .spinner-inline ::ng-deep circle {
      stroke: #FFFFFF !important;
    }

    .error-alert {
      background: #FFF0F0;
      color: #D32F2F;
      border: 1px solid #FFCDD2;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 14px;
      text-align: left;
    }

    .bottom-link {
      margin-top: 24px;
    }

    .bottom-link a {
      color: #D4A843;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }

    .bottom-link a:hover {
      text-decoration: underline;
      color: #B8860B;
    }

    mat-form-field {
      margin-bottom: 8px;
    }
  `],
})
export class SuperAdminLoginComponent {
  form: FormGroup;
  loading = false;
  hidePassword = true;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    this.authService
      .superAdminLogin({
        username: this.form.value.username,
        password: this.form.value.password,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success) {
            this.router.navigate(['/superadmin/dashboard']);
          } else {
            this.errorMessage = res.message || 'Invalid credentials. Please try again.';
          }
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage =
            err.error?.message || 'Invalid credentials. Please check your email and password.';
        },
      });
  }
}
