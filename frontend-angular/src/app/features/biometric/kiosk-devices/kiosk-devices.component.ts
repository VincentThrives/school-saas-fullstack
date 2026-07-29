import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface Device {
  deviceId: string;
  label: string;
  pairedAt: string;
  lastSeenAt: string | null;
}

/**
 * Kiosk Devices management page — admin generates pairing codes here,
 * sees which tablets are paired to this school, and revokes any of
 * them with one click.
 */
@Component({
  selector: 'app-kiosk-devices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './kiosk-devices.component.html',
  styleUrl: './kiosk-devices.component.scss',
})
export class KioskDevicesComponent implements OnInit {

  devices: Device[] = [];
  isLoading = false;

  // Pairing code state
  newLabel = '';
  activeCode: string | null = null;
  activeCodeExpiresAt: string | null = null;
  isGenerating = false;
  secondsLeft = 0;
  private countdownTimer: any = null;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.api.listKioskDevices().subscribe({
      next: (res) => {
        this.devices = (res?.data as Device[]) || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.devices = [];
      },
    });
  }

  generateCode(): void {
    this.isGenerating = true;
    this.api.createKioskPairingCode(this.newLabel || undefined).subscribe({
      next: (res) => {
        this.isGenerating = false;
        this.activeCode = res?.data?.code || null;
        this.activeCodeExpiresAt = res?.data?.expiresAt || null;
        this.startCountdown();
      },
      error: (err) => {
        this.isGenerating = false;
        this.snackBar.open(err?.error?.message || 'Failed to generate code',
            'Close', { duration: 3000 });
      },
    });
  }

  cancelCode(): void {
    this.activeCode = null;
    this.activeCodeExpiresAt = null;
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  private startCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    const tick = () => {
      if (!this.activeCodeExpiresAt) { this.secondsLeft = 0; return; }
      const ms = new Date(this.activeCodeExpiresAt).getTime() - Date.now();
      this.secondsLeft = Math.max(0, Math.floor(ms / 1000));
      if (this.secondsLeft === 0) {
        this.activeCode = null;
        this.activeCodeExpiresAt = null;
        clearInterval(this.countdownTimer);
        this.load();
      }
    };
    tick();
    this.countdownTimer = setInterval(tick, 1000);
  }

  countdownLabel(): string {
    const m = Math.floor(this.secondsLeft / 60);
    const s = this.secondsLeft % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  }

  revoke(device: Device): void {
    const ok = confirm(`Revoke "${device.label}"? The tablet will stop scanning immediately.`);
    if (!ok) return;
    this.api.revokeKioskDevice(device.deviceId).subscribe({
      next: () => {
        this.snackBar.open('Device revoked', 'Close', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Revoke failed',
            'Close', { duration: 3000 });
      },
    });
  }

  formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString(undefined,
        { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  splitCodeDigits(): string[] {
    return this.activeCode ? this.activeCode.split('') : [];
  }
}
