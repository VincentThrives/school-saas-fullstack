import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

/**
 * Biometric Settings page — a small settings surface where the tenant
 * admin picks which methods (card / face) the gate tablet accepts and
 * what the late cutoff is. Feature-flag gated at the sidebar level.
 */
@Component({
  selector: 'app-biometric-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './biometric-settings.component.html',
  styleUrl: './biometric-settings.component.scss',
})
export class BiometricSettingsComponent implements OnInit {

  cardEnabled = false;
  faceEnabled = true;
  lateCutoff = '09:15';
  openTime = '06:00';
  faceThreshold = 0.55;

  isLoading = false;
  isSaving = false;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.load();
  }

  get canSave(): boolean {
    if (!this.cardEnabled && !this.faceEnabled) return false;
    if (!this.lateCutoff || !this.lateCutoff.match(/^\d{1,2}:\d{2}$/)) return false;
    return true;
  }

  private load(): void {
    this.isLoading = true;
    this.api.getBiometricSettings().subscribe({
      next: (res) => {
        const s = res?.data || {};
        this.cardEnabled = !!s.cardEnabled;
        this.faceEnabled = s.faceEnabled === undefined ? true : !!s.faceEnabled;
        this.lateCutoff = s.lateCutoff || '09:15';
        this.openTime = s.openTime || '06:00';
        this.faceThreshold = typeof s.faceThreshold === 'number' ? s.faceThreshold : 0.55;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load settings', 'Close', { duration: 3000 });
      },
    });
  }

  save(): void {
    if (!this.canSave) return;
    this.isSaving = true;
    this.api.saveBiometricSettings({
      cardEnabled: this.cardEnabled,
      faceEnabled: this.faceEnabled,
      lateCutoff: this.lateCutoff,
      openTime: this.openTime,
      faceThreshold: this.faceThreshold,
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Settings saved', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Save failed', 'Close', { duration: 3500 });
      },
    });
  }
}
