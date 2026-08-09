import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { BiometricSettings } from '../../../core/models';

@Component({
  selector: 'app-biometric-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './biometric-settings.component.html',
  styleUrl: './biometric-settings.component.scss',
})
export class BiometricSettingsComponent implements OnInit {

  settings: BiometricSettings = {
    lateCutoff: '09:15',
    earliestExitTime: '14:00',
    notifyOnEntry: true,
    notifyOnExit: false,
    notifyOnEarlyLeave: true,
  };

  isLoading = false;
  isSaving = false;

  constructor(private api: ApiService, private snack: MatSnackBar) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.api.getBiometricSettings().subscribe({
      next: (res) => {
        if (res?.data) this.settings = { ...res.data };
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load settings — using defaults', 'Close', { duration: 3000 });
      },
    });
  }

  save(): void {
    if (!this.isValidTime(this.settings.lateCutoff) || !this.isValidTime(this.settings.earliestExitTime)) {
      this.snack.open('Times must be HH:mm (24-hour)', 'Close', { duration: 3000 });
      return;
    }
    this.isSaving = true;
    this.api.saveBiometricSettings(this.settings).subscribe({
      next: (res) => {
        this.isSaving = false;
        if (res?.data) this.settings = { ...res.data };
        this.snack.open('Settings saved', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.message || 'Failed to save settings';
        this.snack.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  private isValidTime(v: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
  }
}
