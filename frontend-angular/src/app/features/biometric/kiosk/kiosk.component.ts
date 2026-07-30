import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FaceRecognitionService } from '../../../core/services/face-recognition.service';
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
  schoolCode: string;
}

interface MarkedRow {
  studentId: string;
  name: string;
  className: string;
  rollNumber: string | null;
  photoBase64: string | null;
  status: string;
  method: string;
  /** IN or OUT — for the row's badge. */
  direction: 'IN' | 'OUT';
  /** Formatted IN time (empty until IN happens). */
  entryTime: string;
  /** Formatted OUT time (empty until OUT happens). */
  exitTime: string;
}

/**
 * Kiosk — split-screen "scanner" UX. Camera runs continuously on the
 * left, marked + pending lists on the right sidebar. Each auto-loop
 * tick captures a frame, computes an embedding, finds the best face
 * match in the loaded roster, and if the score clears the threshold,
 * scans the student in. Welcome overlay flashes for ~2.5s and the
 * scanner returns to the ambient camera view.
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
  private readonly AUTO_LOOP_MS = 1400;

  /** Match threshold — read from tenant settings on boot, falls back
   *  to 0.65 (matches the backend default for FaceNet cosine) if the
   *  fetch fails. */
  matchThreshold = 0.65;

  /** Tenant's exit-tracking mode — decides whether the IN/OUT toggle
   *  appears on the kiosk and whether the tablet sends a direction
   *  with each scan. */
  exitTracking: 'OFF' | 'AUTO' | 'MANUAL' = 'OFF';

  /** MANUAL-mode toggle position — admin flips at dismissal time. */
  manualDirection: 'IN' | 'OUT' = 'IN';

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

  // Camera + auto-loop
  @ViewChild('kioskVideo') videoEl?: ElementRef<HTMLVideoElement>;
  cameraOpen = false;
  cameraError: string | null = null;
  private videoStream: MediaStream | null = null;
  private autoLoopTimer: any = null;
  private busy = false;
  hint: string | null = null;

  // Card input
  cardInput = '';
  isScanning = false;
  scanError: string | null = null;

  // Welcome overlay
  showResult = false;
  resultName = '';
  resultClassName = '';
  resultPhoto: string | null = null;
  resultTime = '';
  resultStatus = '';
  resultAlreadyMarked = false;
  resultMethod = '';
  resultDirection: 'IN' | 'OUT' = 'IN';
  private resultTimer: any = null;

  // Session lists
  markedRows: MarkedRow[] = [];
  private markedIds = new Set<string>();

  /** Which tab is showing on the right sidebar — 'marked' or
   *  'unmarked'. Users switch between the two; only one list is
   *  visible at a time so the layout fits comfortably on tablets. */
  activeTab: 'marked' | 'unmarked' = 'unmarked';

  constructor(private http: HttpClient,
              private faceRecognition: FaceRecognitionService) {}

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
    // Warm up the face-recognition model files so the auto-loop can
    // start scanning as soon as the operator hits Start scanner.
    this.faceRecognition.initialize()
        .catch(err => console.warn('Face-api model load failed', err));
  }

  ngOnDestroy(): void {
    document.body.classList.remove('kiosk-mode');
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.stopCamera();
  }

  // ── Pairing ────────────────────────────────────────────────

  onDigitInput(idx: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');

    if (raw.length > 1) {
      for (let i = 0; i < raw.length && idx + i < 6; i++) {
        this.pairCodeDigits[idx + i] = raw[i];
      }
      input.value = this.pairCodeDigits[idx] || '';
      const target = Math.min(5, idx + raw.length);
      setTimeout(() => this.focusDigit(target));
      return;
    }

    const val = raw.slice(0, 1);
    this.pairCodeDigits[idx] = val;
    input.value = val;

    if (val && idx < 5) {
      setTimeout(() => {
        const next = this.getDigitEl(idx + 1);
        if (next) {
          next.value = this.pairCodeDigits[idx + 1] || '';
          next.focus();
          next.select();
        }
      });
    }
  }

  onDigitBackspace(idx: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.pairCodeDigits[idx] && idx > 0) {
      const prev = this.getDigitEl(idx - 1);
      prev?.focus();
    }
  }

  private getDigitEl(idx: number): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>(`input[data-digit="${idx}"]`);
  }

  private focusDigit(idx: number): void {
    const el = this.getDigitEl(idx);
    if (el) { el.focus(); el.select(); }
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
          schoolCode: data.schoolCode || this.pairSchoolCode.trim(),
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

  // ── Runtime ────────────────────────────────────────────────

  loadRoster(): void {
    if (!this.state) return;
    this.isLoadingRoster = true;
    const headers = this.deviceHeaders();
    this.http.get<any>(`${this.API}/biometric/kiosk/roster`, { headers })
        .pipe(finalize(() => this.isLoadingRoster = false))
        .subscribe({
          next: (res) => {
            this.roster = (res?.data as RosterEntry[]) || [];
            // Also pull anyone already marked today so a fresh kiosk
            // boot shows the running list, not just this-session scans.
            this.loadTodayScans();
            this.loadSettings();
          },
          error: (err) => {
            if (err?.status === 401 || err?.status === 403) this.clearState();
          },
        });
  }

  /** Fetch tenant biometric settings so the kiosk honors the
   *  admin-picked face-match threshold instead of a hardcoded value. */
  private loadSettings(): void {
    if (!this.state) return;
    const headers = this.deviceHeaders();
    this.http.get<any>(`${this.API}/biometric/kiosk/settings`, { headers })
        .subscribe({
          next: (res) => {
            const s = res?.data || {};
            if (typeof s.faceThreshold === 'number' && s.faceThreshold > 0 && s.faceThreshold < 1) {
              this.matchThreshold = s.faceThreshold;
            }
            if (s.exitTracking === 'AUTO' || s.exitTracking === 'MANUAL' || s.exitTracking === 'OFF') {
              this.exitTracking = s.exitTracking;
            }
          },
        });
  }

  /** Pre-populate the Marked tab from today's existing scans. Backend
   *  collapses each student to a single row with the earliest IN and
   *  latest OUT stamped separately — so a student who scanned both
   *  times still appears once. */
  private loadTodayScans(): void {
    if (!this.state) return;
    const headers = this.deviceHeaders();
    this.http.get<any>(`${this.API}/biometric/kiosk/scans/today`, { headers })
        .subscribe({
          next: (res) => {
            const rows = (res?.data as any[]) || [];
            for (const r of rows) {
              if (this.markedIds.has(r.studentId)) continue;
              this.markedIds.add(r.studentId);
              this.markedRows.push({
                studentId: r.studentId,
                name: r.name,
                className: r.className,
                rollNumber: r.rollNumber || null,
                photoBase64: r.photoBase64,
                status: r.status || 'PRESENT',
                method: r.method || '',
                direction: r.direction || 'IN',
                entryTime: this.fmtTime(r.entryAt),
                exitTime: this.fmtTime(r.exitAt),
              });
            }
          },
        });
  }

  private fmtTime(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString(undefined,
        { hour: '2-digit', minute: '2-digit' });
  }

  clearState(): void {
    this.stopCamera();
    this.state = null;
    localStorage.removeItem(this.STORAGE_KEY);
    this.roster = [];
    this.markedRows = [];
    this.markedIds.clear();
  }

  private deviceHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-Device-Token': this.state?.deviceToken || '',
      'X-School-Code': this.state?.schoolCode || '',
      'Content-Type': 'application/json',
    });
  }

  // ── Camera + continuous auto-loop ──────────────────────────

  async startCamera(): Promise<void> {
    this.cameraError = null;
    this.hint = null;
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      this.cameraOpen = true;
      setTimeout(() => {
        if (this.videoEl && this.videoStream) {
          this.videoEl.nativeElement.srcObject = this.videoStream;
          this.videoEl.nativeElement.play().catch(() => { /* ok */ });
        }
      });
      this.startAutoLoop();
    } catch (err: any) {
      this.cameraError = err?.message
          || 'Could not access the camera. Check the tablet has camera permission.';
    }
  }

  stopCamera(): void {
    if (this.autoLoopTimer) clearInterval(this.autoLoopTimer);
    this.autoLoopTimer = null;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
    this.cameraOpen = false;
    this.hint = null;
  }

  private startAutoLoop(): void {
    if (this.autoLoopTimer) clearInterval(this.autoLoopTimer);
    this.autoLoopTimer = setInterval(() => this.tick(), this.AUTO_LOOP_MS);
  }

  /** One capture-and-match cycle. Skips if busy, if welcome overlay is
   *  showing, if the video isn't ready, if no face is in the frame, or
   *  if the best match is already marked. */
  private async tick(): Promise<void> {
    if (this.busy) return;
    if (this.showResult) return;
    if (this.scanError) return;   // wait for the rejection overlay to clear
    if (!this.videoEl || !this.videoStream) return;
    const video = this.videoEl.nativeElement;
    if (video.readyState < 2) return;   // metadata not loaded yet

    if (!this.faceRecognition.isReady()) {
      this.hint = 'Loading face recognition model…';
      return;
    }

    this.busy = true;
    try {
      const embedding = await this.faceRecognition.computeEmbedding(video);
      if (!embedding) {
        // Real face detection said no face in view — a wall or empty
        // doorway won't produce an embedding, so no false matches.
        this.hint = 'Waiting for someone to face the camera…';
        return;
      }

      const match = this.matchAgainstRoster(embedding);
      if (!match) return;

      if (match.score < this.matchThreshold) {
        this.hint = `Looking… best guess ${match.name} (${Math.round(match.score * 100)}%)`;
        setTimeout(() => { if (!this.showResult) this.hint = null; }, 1200);
        return;
      }

      if (this.isStudentDone(match.studentId)) {
        const row = this.markedRows.find(r => r.studentId === match.studentId);
        if (row) this.showAlreadyMarkedOverlay(row);
        return;
      }

      this.hint = null;
      // Keep busy=true across the network call so the next tick doesn't
      // stack on top; scan()'s onFinally callback releases it.
      this.scan({ method: 'FACE', matchedStudentId: match.studentId },
                () => this.busy = false);
      return;
    } finally {
      // Release busy for every path except the scan() branch above,
      // which handles its own release via onFinally.
      if (!this.isScanning) this.busy = false;
    }
  }

  /** Given a live-frame face embedding, pick the closest enrolled
   *  student. Returns null if the roster has no enrolled embeddings
   *  of matching dimension. */
  private matchAgainstRoster(embedding: number[]):
      { studentId: string; name: string; score: number } | null {
    let bestId: string | null = null;
    let bestName = '';
    let bestScore = -1;
    for (const s of this.roster) {
      if (!s.faceEmbedding || s.faceEmbedding.length !== embedding.length) continue;
      const score = this.faceRecognition.cosineSimilarity(embedding, s.faceEmbedding);
      if (score > bestScore) {
        bestScore = score;
        bestId = s.studentId;
        bestName = s.name;
      }
    }
    return bestId ? { studentId: bestId, name: bestName, score: bestScore } : null;
  }


  // ── Card + scan submit ─────────────────────────────────────

  submitCardScan(): void {
    const uid = this.cardInput.trim();
    if (!uid) return;
    this.scan({ method: 'CARD', cardUid: uid });
    this.cardInput = '';
  }

  private scan(payload: any, onFinally?: () => void): void {
    this.isScanning = true;
    this.scanError = null;
    // In MANUAL mode the tablet tells the backend which direction —
    // in OFF and AUTO the field is ignored and the server decides.
    const body: any = {
      ...payload,
      scannedAt: new Date().toISOString(),
    };
    if (this.exitTracking === 'MANUAL') body.direction = this.manualDirection;
    this.http.post<any>(`${this.API}/biometric/kiosk/scan`, body,
        { headers: this.deviceHeaders() })
        .pipe(finalize(() => {
          this.isScanning = false;
          if (onFinally) onFinally();
        }))
        .subscribe({
          next: (res) => {
            const data = res?.data;
            this.showWelcome(data);
          },
          error: (err) => {
            this.scanError = err?.error?.message || 'Scan failed';
            setTimeout(() => this.scanError = null, 3000);
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
    this.resultDirection = data.direction === 'OUT' ? 'OUT' : 'IN';
    this.showResult = true;

    // Merge into the sidebar row: a student may appear once — the row
    // shows entry time on the IN scan and grows an exit time on the
    // OUT scan.
    const existing = this.markedRows.find(r => r.studentId === data.studentId);
    if (existing) {
      existing.entryTime = this.fmtTime(data.entryAt) || existing.entryTime;
      existing.exitTime = this.fmtTime(data.exitAt) || existing.exitTime;
      existing.direction = this.resultDirection;
      existing.status = this.resultStatus || existing.status;
      existing.method = this.resultMethod || existing.method;
      // Bump to top so the freshest action is visible.
      this.markedRows = [existing, ...this.markedRows.filter(r => r !== existing)];
    } else {
      this.markedIds.add(data.studentId);
      this.markedRows.unshift({
        studentId: data.studentId,
        name: data.name,
        className: data.className,
        rollNumber: data.rollNumber || null,
        photoBase64: data.photoBase64,
        status: this.resultStatus,
        method: this.resultMethod,
        direction: this.resultDirection,
        entryTime: this.fmtTime(data.entryAt) || (this.resultDirection === 'IN' ? this.resultTime : ''),
        exitTime: this.fmtTime(data.exitAt) || (this.resultDirection === 'OUT' ? this.resultTime : ''),
      });
    }
    // Auto-flip to Marked so the admin sees the fresh row appear.
    this.activeTab = 'marked';

    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => {
      this.showResult = false;
      this.resultPhoto = null;
    }, 2500);
  }

  /** Whether a student's attendance is "done" from the auto-loop's
   *  point of view — a fresh face scan would be a no-op. Rules:
   *   · OFF    → any scan means done
   *   · AUTO   → done when both IN and OUT are on the row
   *   · MANUAL → done for the currently-selected direction (IN toggle
   *              blocks re-scans of anyone with an IN today; OUT toggle
   *              blocks re-scans of anyone with an OUT today) */
  private isStudentDone(studentId: string): boolean {
    const row = this.markedRows.find(r => r.studentId === studentId);
    if (!row) return false;
    if (this.exitTracking === 'OFF') return true;
    if (this.exitTracking === 'AUTO') return !!(row.entryTime && row.exitTime);
    return this.manualDirection === 'IN' ? !!row.entryTime : !!row.exitTime;
  }

  /** Big overlay for the "you're already marked" case — mirrors
   *  showWelcome() but populates from an existing sidebar row instead
   *  of a fresh server response. Kept in sync with the same result*
   *  state fields so the template just re-uses the welcome overlay. */
  private showAlreadyMarkedOverlay(row: MarkedRow): void {
    // Skip if the same student's overlay is already up — avoids
    // resetting the timer every tick they stand in front of the camera.
    if (this.showResult && this.resultName === row.name && this.resultAlreadyMarked) {
      return;
    }
    this.resultName = row.name;
    this.resultClassName = row.className;
    this.resultPhoto = row.photoBase64
        ? ('data:image/jpeg;base64,' + row.photoBase64)
        : null;
    // Prefer the freshest known timestamp — OUT if it exists, else IN.
    this.resultTime = row.exitTime || row.entryTime || '';
    this.resultStatus = row.status;
    this.resultAlreadyMarked = true;
    this.resultMethod = row.method;
    this.resultDirection = row.direction;
    this.showResult = true;
    this.hint = null;

    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => {
      this.showResult = false;
      this.resultPhoto = null;
    }, 2500);
  }

  // ── Derived lists for the sidebar ──────────────────────────

  get pendingRoster(): RosterEntry[] {
    return this.roster.filter(r => !this.markedIds.has(r.studentId));
  }

  get markedCount(): number { return this.markedRows.length; }

  get lateCount(): number {
    return this.markedRows.filter(m => m.status === 'LATE').length;
  }

  // ── Clock ──────────────────────────────────────────────────

  clockLabel(): string {
    return this.now.toLocaleString(undefined,
        { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

}
