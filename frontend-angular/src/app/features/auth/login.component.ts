import { Component, OnInit } from '@angular/core';
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
import { TenantPublicInfo } from '../../core/models';

@Component({
  selector: 'app-login',
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
      <div class="auth-card" *ngIf="schoolInfo">
        <div class="school-header">
          <div class="school-logo" *ngIf="schoolInfo.logoUrl; else defaultLogo">
            <img [src]="schoolInfo.logoUrl" [alt]="schoolInfo.schoolName" />
          </div>
          <ng-template #defaultLogo>
            <div class="logo-circle">
              <span class="logo-letter">{{ schoolInfo.schoolName?.charAt(0) || 'S' }}</span>
            </div>
          </ng-template>
          <h1 class="school-name">{{ schoolInfo.schoolName }}</h1>
        </div>

        <div class="error-alert" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email or Username</mat-label>
            <input
              matInput
              formControlName="username"
              placeholder="Enter your email or username"
              autocomplete="username"
            />
            <mat-error *ngIf="form.controls['username'].hasError('required')">
              Email or username is required
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

          <div class="forgot-password-row">
            <a href="javascript:void(0)" class="forgot-link">Forgot password?</a>
          </div>

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
          <a routerLink="/login" (click)="onBackToSchoolId()">
            &larr; Use a different School ID
          </a>
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

    .school-header {
      margin-bottom: 32px;
    }

    .school-logo img {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 16px;
    }

    .logo-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #D4A843 0%, #B8860B 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .logo-letter {
      font-size: 32px;
      font-weight: 700;
      color: #FFFFFF;
    }

    .school-name {
      font-size: 20px;
      font-weight: 600;
      color: #1A1A1A;
      margin: 0;
    }

    .full-width {
      width: 100%;
    }

    .forgot-password-row {
      text-align: right;
      margin-bottom: 16px;
      margin-top: -4px;
    }

    .forgot-link {
      color: #D4A843;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
    }

    .forgot-link:hover {
      text-decoration: underline;
      color: #B8860B;
    }

    .gold-button {
      background: linear-gradient(135deg, #D4A843 0%, #B8860B 100%) !important;
      color: #FFFFFF !important;
      height: 48px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px !important;
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
export class LoginComponent implements OnInit {
  form: FormGroup;
  loading = false;
  hidePassword = true;
  errorMessage = '';
  schoolInfo: TenantPublicInfo | null = null;

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

  ngOnInit(): void {
    this.schoolInfo = this.authService.currentSchoolInfo;
    if (!this.schoolInfo) {
      this.router.navigate(['/login']);
    }
  }

  onSubmit(): void {
    if (this.form.invalid || !this.schoolInfo) return;

    this.loading = true;
    this.errorMessage = '';

    this.authService
      .login({
        tenantId: this.schoolInfo.tenantId,
        username: this.form.value.username,
        password: this.form.value.password,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success) {
            this.router.navigate(['/dashboard']);
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

  onBackToSchoolId(): void {
    this.authService.clearTenant();
  }
}
