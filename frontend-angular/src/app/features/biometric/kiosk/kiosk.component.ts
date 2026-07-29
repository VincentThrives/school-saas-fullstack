import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { finalize } from 'rxjs';

interface RosterEntry {
  studentId: string;
  name: string;
  rollNumber: string | null;
  className: string;
  cardUid: string | null;
  photoBase64: string | null;
  faceEmbedding: number[] | null;
}

interface KioskState {
  deviceToken: string;
  deviceLabel: string;
  tenantId: string;
  tenantName: string;
}

/**
 * Kiosk page — outside the app shell, no user login required. Runs in
 * two modes:
 *   1. Unpaired: shows the school-code + 6-digit code entry.
 *   2. Paired: pulls the morning roster and shows the scan screen.
 *
 * All API calls attach {@code X-Device-Token} (not a user Bearer) via
 * a direct HttpClient — the app's authInterceptor is configured to skip
 * these paths.
 */
@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kiosk.component.html',
  styleUrl: './kiosk.component.scss',
})
export class KioskComponent implements OnInit, OnDestroy {

  private readonly STORAGE_KEY = 'nv_kiosk_state_v1';
  private readonly API = environment.apiUrl;

  state: KioskState | null = null;

  // Pairing screen state
  pairSchoolCode = '';
  pairCodeDigits = ['', '', '', '', '', ''];
  isPairing = false;
  pairError: string | null = null;

  // Runtime state
  roster: RosterEntry[] = [];
  isLoadingRoster = false;
  now = new Date();
  private clockTimer: any = null;

  // Scan input
  cardInput = '';
  studentSearch = '';
  isScanning = false;
  scanError: string | null = null;

  // Result state (welcome card)
  showResult = false;
  resultName = '';
  resultClassName = '';
  resultPhoto: string | null = null;
  resultTime = '';
  resultStatus = '';
  resultAlreadyMarked = false;
  resultMethod = '';
  private resultTimer: any = null;

  // Session counters
  scannedCount = 0;
  lateCount = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    document.body.classList.add('kiosk-mode');
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      try {
        this.state = JSON.parse(raw);
        this.loadRoster();
      } catch { this.clearState(); }
    }
    this.clockTimer = setInterval(() => { this.now = new Date(); }, 1000);
  }

  ngOnDestroy(): void {
    document.body.classList.remove('kiosk-mode');
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.resultTimer) clearTimeout(this.resultTimer);
  }

  // ── Pairing ──────────────────────────────────────────────

  onDigitInput(idx: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(0, 1);
    this.pairCodeDigits[idx] = val;
    if (val && idx < 5) {
      const next = document.querySelector<HTMLInputElement>(
          `input[data-digit="${idx + 1}"]`);
      next?.focus();
    }
  }

  onDigitBackspace(idx: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.pairCodeDigits[idx] && idx > 0) {
      const prev = document.querySelector<HTMLInputElement>(
          `input[data-digit="${idx - 1}"]`);
      prev?.focus();
    }
  }

  get canPair(): boolean {
    return this.pairSchoolCode.trim().length > 0
        && this.pairCodeDigits.every(d => d.length === 1);
  }

  pair(): void {
    if (!this.canPair) return;
    this.isPairing = true;
    this.pairError = null;
    const code = this.pairCodeDigits.join('');
    const url = `${this.API}/biometric/kiosk/pair?schoolCode=${encodeURIComponent(this.pairSchoolCode.trim())}`;
    this.http.post<any>(url, { code }).pipe(finalize(() => this.isPairing = false)).subscribe({
      next: (res) => {
        const data = res?.data;
        this.state = {
          deviceToken: data.deviceToken,
          deviceLabel: data.deviceLabel,
          tenantId: data.tenantId,
          tenantName: data.tenantName,
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        this.pairCodeDigits = ['', '', '', '', '', ''];
        this.pairSchoolCode = '';
        this.loadRoster();
      },
      error: (err) => {
        this.pairError = err?.error?.message || 'Pairing failed';
      },
    });
  }

  // ── Runtime ──────────────────────────────────────────────

  loadRoster(): void {
    if (!this.state) return;
    this.isLoadingRoster = true;
    const headers = this.deviceHeaders();
    this.http.get<any>(`${this.API}/biometric/kiosk/roster`, { headers })
        .pipe(finalize(() => this.isLoadingRoster = false))
        .subscribe({
          next: (res) => {
            this.roster = (res?.data as RosterEntry[]) || [];
          },
          error: (err) => {
            if (err?.status === 401) {
              // Token got revoked; drop back to pairing.
              this.clearState();
            }
          },
        });
  }

  clearState(): void {
    this.state = null;
    localStorage.removeItem(this.STORAGE_KEY);
    this.roster = [];
  }

  private deviceHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-Device-Token': this.state?.deviceToken || '',
      'Content-Type': 'application/json',
    });
  }

  submitCardScan(): void {
    const uid = this.cardInput.trim();
    if (!uid) return;
    this.scan({ method: 'CARD', cardUid: uid });
    this.cardInput = '';
  }

  submitFaceScan(studentId: string): void {
    this.scan({ method: 'FACE', matchedStudentId: studentId });
    this.studentSearch = '';
  }

  private scan(payload: any): void {
    this.isScanning = true;
    this.scanError = null;
    this.http.post<any>(`${this.API}/biometric/kiosk/scan`, {
      ...payload,
      scannedAt: new Date().toISOString(),
    }, { headers: this.deviceHeaders() })
        .pipe(finalize(() => this.isScanning = false))
        .subscribe({
          next: (res) => {
            const data = res?.data;
            this.showWelcome(data);
          },
          error: (err) => {
            this.scanError = err?.error?.message || 'Scan failed';
            setTimeout(() => this.scanError = null, 3500);
          },
        });
  }

  private showWelcome(data: any): void {
    this.resultName = data.name || 'Student';
    this.resultClassName = data.className || '';
    this.resultPhoto = data.photoBase64 ? ('data:image/jpeg;base64,' + data.photoBase64) : null;
    this.resultTime = new Date(data.scannedAt).toLocaleTimeString(undefined,
        { hour: '2-digit', minute: '2-digit' });
    this.resultStatus = data.status || 'PRESENT';
    this.resultAlreadyMarked = !!data.alreadyMarked;
    this.resultMethod = data.method || '';
    this.showResult = true;
    if (!data.alreadyMarked) {
      this.scannedCount++;
      if (data.status === 'LATE') this.lateCount++;
    }
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => {
      this.showResult = false;
      this.resultPhoto = null;
    }, 3000);
  }

  clockLabel(): string {
    return this.now.toLocaleString(undefined,
        { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // ── Manual search for face fallback ──────────────────────

  get filteredRoster(): RosterEntry[] {
    const q = this.studentSearch.trim().toLowerCase();
    if (!q) return this.roster.slice(0, 12);
    return this.roster.filter(r => (r.name || '').toLowerCase().includes(q)
        || (r.rollNumber || '').toLowerCase().includes(q)
        || (r.className || '').toLowerCase().includes(q))
        .slice(0, 12);
  }
}
