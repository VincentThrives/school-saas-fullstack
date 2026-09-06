import {
  AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as L from 'leaflet';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  EmployeeAttendance, PublicAttendanceSettings, User,
} from '../../../../core/models';
import { fixLeafletDefaultIcon } from '../../../../shared/util/leaflet-icon-fix';
import { getCurrentPositionAsync, isGeolocationAvailable } from '../../../../shared/util/geolocation';

/**
 * Full-page Mark IN / OUT flow.
 *
 * <p>Reached from the big action button on {@code /hr/attendance/my}
 * so the employee focuses on one job at a time — the summary page
 * stays a summary, this page is the one-purpose punch surface.
 * Full page (not a modal) so the map gets real estate, native back
 * button works, and there's no dialog-centering complexity.</p>
 *
 * <p>Flow:</p>
 * <ol>
 *   <li>Landing — load public settings + today's row, auto-locate.</li>
 *   <li>Show accuracy banner + map + distance chip + optional
 *       remarks.</li>
 *   <li>Employee taps the big Submit button → send mark → snackbar
 *       success → route back to {@code /hr/attendance/my}.</li>
 * </ol>
 */
@Component({
  selector: 'app-mark-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule,
  ],
  templateUrl: './mark-page.component.html',
  styleUrl: './mark-page.component.scss',
})
export class MarkPageComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  settings: PublicAttendanceSettings | null = null;
  today: EmployeeAttendance | null = null;
  currentUser: User | null = null;

  isLoading = false;
  isLocating = false;
  isSubmitting = false;

  liveLat: number | null = null;
  liveLng: number | null = null;
  liveAccuracyMeters: number | null = null;

  remarks: string = '';

  todayIso = this.formatDateLocal(new Date());

  private map?: L.Map;
  private liveMarker?: L.Marker;
  private liveCircle?: L.Circle;
  private campusMarker?: L.Marker;
  private campusCircle?: L.Circle;

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private router: Router,
    private location: Location,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.load();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.tryInitMap(), 80);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ── Data ─────────────────────────────────────

  private load(): void {
    this.isLoading = true;
    this.api.hrPublicSettings().subscribe({
      next: (res) => {
        this.settings = res.data;
        this.isLoading = false;
        setTimeout(() => {
          this.tryInitMap();
          this.refreshLocation(true);
        }, 40);
      },
      error: () => { this.isLoading = false; },
    });
    this.api.hrMyAttendance().subscribe({
      next: (res) => {
        const rows = res.data || [];
        this.today = rows.find(r => r.date === this.todayIso) || null;
      },
    });
  }

  goBack(): void {
    // Prefer the browser history when there is any so pages that
    // deep-link into /mark still land somewhere sensible; otherwise
    // fall back to the summary page.
    if (window.history.length > 1) this.location.back();
    else this.router.navigate(['/hr/attendance/my']);
  }

  // ── Map ──────────────────────────────────────

  private tryInitMap(): void {
    if (this.map) return;
    if (!this.mapContainer) return;
    if (!this.settings?.locationBasedEnabled) return;

    fixLeafletDefaultIcon();

    const campusLat = this.settings.campusLatitude ?? 12.9716;
    const campusLng = this.settings.campusLongitude ?? 77.5946;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [campusLat, campusLng],
      zoom: 17,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    if (this.settings.campusLatitude != null && this.settings.campusLongitude != null) {
      const greenIcon = L.divIcon({
        className: 'mkp-campus-pin',
        html: '<div class="mkp-campus-pin-inner"><span class="material-icons">apartment</span></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      this.campusMarker = L.marker([campusLat, campusLng],
        { icon: greenIcon, interactive: false })
        .addTo(this.map)
        .bindTooltip('Campus', { permanent: false, direction: 'top' });

      this.campusCircle = L.circle([campusLat, campusLng], {
        radius: this.settings.allowedRadiusMeters,
        color: '#B8860B',
        weight: 2,
        fillColor: '#D4A843',
        fillOpacity: 0.10,
      }).addTo(this.map);
    }
  }

  // ── Location ─────────────────────────────────

  refreshLocation(silent = false): void {
    if (this.isLocating) return;
    if (!isGeolocationAvailable()) {
      if (!silent) this.snack.open(
        'Location is not available on this device.', 'Close', { duration: 3500 });
      return;
    }
    this.isLocating = true;
    getCurrentPositionAsync({ enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 })
      .then((pos) => {
        this.isLocating = false;
        this.liveLat = pos.coords.latitude;
        this.liveLng = pos.coords.longitude;
        this.liveAccuracyMeters = pos.coords.accuracy;
        this.updateLiveMarker();
        this.fitBothOnMap();
      })
      .catch((err: any) => {
        this.isLocating = false;
        if (silent) return;
        const msg = err?.code === 1
          ? 'Location permission denied. Enable it in your device settings.'
          : 'Couldn\'t get your location. Try again in an open area.';
        this.snack.open(msg, 'Close', { duration: 4500 });
      });
  }

  private updateLiveMarker(): void {
    if (!this.map || this.liveLat == null || this.liveLng == null) return;
    const redIcon = L.divIcon({
      className: 'mkp-live-pin',
      html: '<div class="mkp-live-pin-inner"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    if (this.liveMarker) this.liveMarker.remove();
    if (this.liveCircle) this.liveCircle.remove();
    this.liveMarker = L.marker([this.liveLat, this.liveLng],
      { icon: redIcon, interactive: false }).addTo(this.map)
      .bindTooltip('You are here', { permanent: false, direction: 'top' });
    if (this.liveAccuracyMeters != null) {
      this.liveCircle = L.circle([this.liveLat, this.liveLng], {
        radius: this.liveAccuracyMeters,
        color: '#ef4444',
        weight: 1,
        fillColor: '#ef4444',
        fillOpacity: 0.10,
      }).addTo(this.map);
    }
  }

  private fitBothOnMap(): void {
    if (!this.map || this.liveLat == null || this.liveLng == null) return;
    if (this.settings?.campusLatitude != null && this.settings?.campusLongitude != null) {
      const bounds = L.latLngBounds(
        [this.liveLat, this.liveLng],
        [this.settings.campusLatitude, this.settings.campusLongitude],
      );
      this.map.fitBounds(bounds.pad(0.4), { maxZoom: 18 });
    } else {
      this.map.setView([this.liveLat, this.liveLng], 17);
    }
  }

  // ── Computed ─────────────────────────────────

  get distanceMeters(): number | null {
    if (this.liveLat == null || this.liveLng == null) return null;
    if (this.settings?.campusLatitude == null || this.settings?.campusLongitude == null) return null;
    return haversineMeters(this.liveLat, this.liveLng,
      this.settings.campusLatitude, this.settings.campusLongitude);
  }

  get insideRadius(): boolean {
    const d = this.distanceMeters;
    if (d == null || !this.settings) return false;
    return d <= this.settings.allowedRadiusMeters;
  }

  get accuracyBand(): 'good' | 'fair' | 'poor' | 'none' {
    if (this.liveAccuracyMeters == null) return 'none';
    if (this.liveAccuracyMeters <= 20) return 'good';
    if (this.liveAccuracyMeters <= 60) return 'fair';
    return 'poor';
  }

  get accuracyLabel(): string {
    switch (this.accuracyBand) {
      case 'good': return 'Good';
      case 'fair': return 'Fair';
      case 'poor': return 'Poor';
      default:     return 'Locating…';
    }
  }

  get punchButtonLabel(): string {
    if (!this.today) return 'Mark IN';
    if (!this.today.outTime) return 'Mark OUT';
    return 'Done for today';
  }

  get pageTitle(): string {
    if (!this.today) return 'Mark IN';
    if (!this.today.outTime) return 'Mark OUT';
    return 'Attendance';
  }

  get canPunch(): boolean {
    if (!this.settings?.locationBasedEnabled) return false;
    if (!this.today) return true;
    if (this.settings.expectedPunchesPerDay >= 2 && !this.today.outTime) return true;
    return false;
  }

  // ── Submit ───────────────────────────────────

  submit(): void {
    if (this.isSubmitting || !this.canPunch) return;
    if (this.liveLat == null || this.liveLng == null) {
      // Fetch a fresh fix then recurse — avoids a second permission
      // prompt vs. calling getCurrentPosition twice.
      if (!isGeolocationAvailable()) {
        this.snack.open(
          'Location is not available on this device. Contact IT.',
          'Close', { duration: 4000 });
        return;
      }
      this.isSubmitting = true;
      getCurrentPositionAsync({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
        .then((pos) => {
          this.liveLat = pos.coords.latitude;
          this.liveLng = pos.coords.longitude;
          this.liveAccuracyMeters = pos.coords.accuracy;
          this.updateLiveMarker();
          this.fitBothOnMap();
          this.doSubmit();
        })
        .catch((err: any) => {
          this.isSubmitting = false;
          const msg = err?.code === 1
            ? 'Location permission denied. Enable it in your device settings.'
            : 'Couldn\'t get your location. Move to an open area and try again.';
          this.snack.open(msg, 'Close', { duration: 5000 });
        });
      return;
    }
    this.isSubmitting = true;
    this.doSubmit();
  }

  private doSubmit(): void {
    this.api.hrMarkSelf({
      latitude:  this.liveLat!,
      longitude: this.liveLng!,
      accuracyMeters: this.liveAccuracyMeters ?? 100,
      mocked: false,
    }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        const direction = res.data?.punchDirection || 'IN';
        const time = this.formatTime(res.data?.inTime, res.data?.outTime, direction);
        this.snack.open(`Marked ${direction} at ${time}`,
          'Close', { duration: 3500 });
        // Route back to the summary page — that's where the fresh
        // status + updated row will be shown.
        this.router.navigate(['/hr/attendance/my']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snack.open(err?.error?.message || 'Failed to mark attendance',
          'Close', { duration: 5000 });
      },
    });
  }

  // ── Helpers ─────────────────────────────────

  get welcomeName(): string {
    const u = this.currentUser;
    if (!u) return '';
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return full || u.username || '';
  }

  formatDistance(m: number | null): string {
    if (m == null) return '—';
    return m < 1000 ? `${m.toFixed(1)} m` : `${(m / 1000).toFixed(2)} km`;
  }

  private formatTime(inTime?: string, outTime?: string, direction: string = 'IN'): string {
    const iso = direction === 'OUT' ? outTime : inTime;
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-IN',
      { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  private formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

/** Same haversine as GeofenceService — matches the server-side
 *  distance the geofence check enforces. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
