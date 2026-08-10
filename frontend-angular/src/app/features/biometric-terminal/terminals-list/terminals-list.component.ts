import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { BiometricTerminal } from '../../../core/models';
import { environment } from '../../../../environments/environment';

interface RegisterDialogState {
  serial: string;
  label: string;
}

interface EditDialogState {
  serial: string;
  label: string;
}

@Component({
  selector: 'app-terminals-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule, MatChipsModule,
    PageHeaderComponent,
  ],
  templateUrl: './terminals-list.component.html',
  styleUrl: './terminals-list.component.scss',
})
export class TerminalsListComponent implements OnInit {

  terminals: BiometricTerminal[] = [];
  isLoading = false;
  displayedColumns = ['label', 'serial', 'lastSeen', 'bindings', 'actions'];

  // Dialogs are inline (mat-dialog opened programmatically would be
  // heavier for the two simple forms we need here — one to add, one to
  // edit — so we track their state on the component and toggle *ngIf
  // sections in the template).
  registerOpen = false;
  register: RegisterDialogState = { serial: '', label: '' };
  isRegistering = false;

  editOpen = false;
  editState: EditDialogState = { serial: '', label: '' };
  isSaving = false;

  deleteOpen = false;
  toDelete: BiometricTerminal | null = null;
  isDeleting = false;

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.api.listBiometricTerminals().subscribe({
      next: (res) => {
        this.terminals = res?.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load terminals', 'Close', { duration: 3000 });
      },
    });
  }

  /** School admins paste this URL into the terminal's "Cloud server
   *  address" field. We show a <schoolCode> placeholder rather than
   *  guessing the tenant subdomain — the resolveTenant response
   *  doesn't currently carry it, and asking the admin to substitute
   *  their own login code is unambiguous. */
  get admsUrl(): string {
    // API host without the trailing /api/v1 — the terminal appends its
    // own /iclock/cdata suffix. environment.apiUrl on prod ends with
    // /api/v1; strip it if present so the pasted value is clean.
    const api = environment.apiUrl || '';
    const host = api.replace(/\/?api\/v1\/?$/, '');
    const base = host || 'https://api.nammavidyalaya.com';
    return `${base}/api/v1/adms/<schoolCode>`;
  }

  openRegister(): void {
    this.register = { serial: '', label: '' };
    this.registerOpen = true;
  }

  closeRegister(): void { this.registerOpen = false; }

  submitRegister(): void {
    if (!this.register.serial.trim() || !this.register.label.trim()) return;
    this.isRegistering = true;
    this.api.registerBiometricTerminal({
      serial: this.register.serial.trim(),
      label: this.register.label.trim(),
    }).subscribe({
      next: () => {
        this.isRegistering = false;
        this.registerOpen = false;
        this.snack.open('Terminal registered', 'Close', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.isRegistering = false;
        const msg = err?.error?.message || 'Failed to register terminal';
        this.snack.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  openEdit(t: BiometricTerminal): void {
    this.editState = { serial: t.serial, label: t.label };
    this.editOpen = true;
  }

  closeEdit(): void { this.editOpen = false; }

  submitEdit(): void {
    if (!this.editState.label.trim()) return;
    this.isSaving = true;
    this.api.updateBiometricTerminal(this.editState.serial, { label: this.editState.label.trim() })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.editOpen = false;
          this.snack.open('Terminal updated', 'Close', { duration: 2500 });
          this.load();
        },
        error: () => {
          this.isSaving = false;
          this.snack.open('Failed to save changes', 'Close', { duration: 3000 });
        },
      });
  }

  openDelete(t: BiometricTerminal): void {
    this.toDelete = t;
    this.deleteOpen = true;
  }

  closeDelete(): void {
    this.deleteOpen = false;
    this.toDelete = null;
  }

  confirmDelete(): void {
    if (!this.toDelete) return;
    this.isDeleting = true;
    this.api.deleteBiometricTerminal(this.toDelete.serial).subscribe({
      next: () => {
        this.isDeleting = false;
        this.deleteOpen = false;
        this.toDelete = null;
        this.snack.open('Terminal deleted', 'Close', { duration: 2500 });
        this.load();
      },
      error: () => {
        this.isDeleting = false;
        this.snack.open('Failed to delete terminal', 'Close', { duration: 3000 });
      },
    });
  }

  /** Human-friendly "5 min ago" text for the last-seen column. Falls
   *  back to "Never" when the terminal has never pushed. */
  lastSeenRelative(iso?: string): string {
    if (!iso) return 'Never';
    const then = new Date(iso).getTime();
    if (!then) return 'Never';
    const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
    if (seconds < 60) return seconds + 's ago';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.round(hours / 24);
    if (days < 30) return days + 'd ago';
    return new Date(iso).toLocaleDateString();
  }

  /** Traffic-light status derived from lastSeenAt: online (<2 min),
   *  recent (<1 h), idle (<24 h), offline (else / never). Powers the
   *  colored dot on each terminal card. */
  statusOf(iso?: string): 'online' | 'recent' | 'idle' | 'offline' {
    if (!iso) return 'offline';
    const then = new Date(iso).getTime();
    if (!then) return 'offline';
    const minutes = (Date.now() - then) / 60000;
    if (minutes < 2) return 'online';
    if (minutes < 60) return 'recent';
    if (minutes < 60 * 24) return 'idle';
    return 'offline';
  }

  /** Short HH:mm time — used inside the "last punch" chip. */
  scanClockTime(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString(undefined,
      { hour: '2-digit', minute: '2-digit' });
  }

  copyAdmsUrl(): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(this.admsUrl).then(
        () => this.snack.open('URL copied', 'Close', { duration: 1500 }),
        () => this.snack.open('Copy failed — select the URL manually', 'Close', { duration: 3000 }),
      );
    }
  }
}
