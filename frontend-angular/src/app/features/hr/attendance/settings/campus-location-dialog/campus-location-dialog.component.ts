import {
  AfterViewInit, Component, ElementRef, Inject, OnDestroy, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import * as L from 'leaflet';
import { fixLeafletDefaultIcon } from '../../../../../shared/util/leaflet-icon-fix';

/**
 * Modal that lets HR pick / confirm the campus point on an
 * interactive map. Opens from the "Use my current location" button
 * on Attendance Settings.
 *
 * <p>Flow:</p>
 * <ul>
 *   <li>Modal opens — map centers on GPS location if permission
 *       granted, else on the existing campus coords (or a fallback
 *       Bangalore centre).</li>
 *   <li>Red pin marks the current GPS reading with an accuracy chip;
 *       a draggable gold pin marks the campus point. A live circle
 *       shows the allowed radius.</li>
 *   <li>HR drags the campus pin (or taps the map) to fine-tune,
 *       then hits "Save location". Dialog returns the picked coords
 *       to the parent settings component.</li>
 * </ul>
 */
@Component({
  selector: 'app-campus-location-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTooltipModule, MatDialogModule,
  ],
  templateUrl: './campus-location-dialog.component.html',
  styleUrl: './campus-location-dialog.component.scss',
})
export class CampusLocationDialogComponent implements AfterViewInit, OnDestroy {

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private campusMarker?: L.Marker;
  private accuracyMarker?: L.Marker;
  private radiusCircle?: L.Circle;
  private accuracyCircle?: L.Circle;

  isLocating = false;
  /** Current picked coordinates — bound to the header display and
   *  sent back to the parent on Save. Starts from the existing
   *  campus point (edit case) or the GPS fix (fresh case). */
  pickedLat: number;
  pickedLng: number;
  /** Freshest GPS reading and its accuracy — drives the top banner. */
  gpsLat: number | null = null;
  gpsLng: number | null = null;
  gpsAccuracyMeters: number | null = null;

  /** Fallback centre if neither GPS nor an existing campus point is
   *  available — Bangalore city centre, close to the school user
   *  base. Only used as a starting viewport, never persisted. */
  private static readonly FALLBACK_LAT = 12.9716;
  private static readonly FALLBACK_LNG = 77.5946;

  constructor(
    private snack: MatSnackBar,
    private ref: MatDialogRef<CampusLocationDialogComponent,
      { lat: number; lng: number } | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: {
      currentLat?: number | null;
      currentLng?: number | null;
      /** Radius in metres — used to draw the "allowed zone" circle
       *  around the campus pin so HR can visually confirm coverage. */
      radiusMeters?: number | null;
    },
  ) {
    this.pickedLat = data.currentLat ?? CampusLocationDialogComponent.FALLBACK_LAT;
    this.pickedLng = data.currentLng ?? CampusLocationDialogComponent.FALLBACK_LNG;
  }

  ngAfterViewInit(): void {
    fixLeafletDefaultIcon();
    this.initMap();
    // Auto-locate on open so the map jumps to the user's actual
    // position — matches "Use my current location" intent.
    this.locateMe(/*silent*/ true);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  /** ── Map bootstrap ─────────────────────────────── */
  private initMap(): void {
    const initialCentre: L.LatLngExpression = [this.pickedLat, this.pickedLng];
    this.map = L.map(this.mapContainer.nativeElement, {
      center: initialCentre,
      zoom: 17,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Campus pin — the actual saved point. Draggable so HR can
    // nudge it if the auto-detected GPS reading is off by a few
    // metres (common inside multi-storey school buildings).
    this.campusMarker = L.marker(initialCentre, { draggable: true })
      .addTo(this.map)
      .bindTooltip('Campus point (drag to adjust)', { permanent: false });

    this.campusMarker.on('drag', (e) => {
      const ll = (e.target as L.Marker).getLatLng();
      this.updatePicked(ll.lat, ll.lng);
    });

    // Tap-anywhere-on-map to move the pin — feels natural on touch
    // devices where dragging a small marker is fiddly.
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.campusMarker?.setLatLng(e.latlng);
      this.updatePicked(e.latlng.lat, e.latlng.lng);
    });

    this.drawRadiusCircle();
  }

  private drawRadiusCircle(): void {
    if (!this.map) return;
    const radius = this.data.radiusMeters || 200;
    if (this.radiusCircle) this.radiusCircle.remove();
    this.radiusCircle = L.circle([this.pickedLat, this.pickedLng], {
      radius,
      color: '#B8860B',
      weight: 2,
      fillColor: '#D4A843',
      fillOpacity: 0.12,
    }).addTo(this.map);
  }

  private updatePicked(lat: number, lng: number): void {
    this.pickedLat = +lat.toFixed(6);
    this.pickedLng = +lng.toFixed(6);
    this.radiusCircle?.setLatLng([this.pickedLat, this.pickedLng]);
  }

  /** ── Locate button ─────────────────────────────── */
  locateMe(silent = false): void {
    if (this.isLocating) return;
    if (!navigator.geolocation) {
      if (!silent) this.snack.open(
        'Your browser doesn\'t support location.', 'Close', { duration: 3500 });
      return;
    }
    this.isLocating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocating = false;
        this.gpsLat = pos.coords.latitude;
        this.gpsLng = pos.coords.longitude;
        this.gpsAccuracyMeters = pos.coords.accuracy;
        this.showGpsPin(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);

        // Only snap the campus pin to the fresh GPS reading when
        // the user hasn't picked one yet (first-time setup); on
        // re-edit we keep the existing pin so HR sees their prior
        // choice and can adjust from there.
        if (this.data.currentLat == null || this.data.currentLng == null) {
          this.campusMarker?.setLatLng([pos.coords.latitude, pos.coords.longitude]);
          this.updatePicked(pos.coords.latitude, pos.coords.longitude);
        }
        this.map?.setView([pos.coords.latitude, pos.coords.longitude], 18);
      },
      (err) => {
        this.isLocating = false;
        if (silent) return;
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Enable it in your browser.'
          : 'Couldn\'t get your location. Try again in an open area.';
        this.snack.open(msg, 'Close', { duration: 4500 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  /** Draw / refresh the red "you are here" pin + accuracy ring. */
  private showGpsPin(lat: number, lng: number, accuracyM: number): void {
    if (!this.map) return;
    const redIcon = L.divIcon({
      className: 'clg-gps-pin',
      html: '<div class="clg-gps-pin-inner"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    if (this.accuracyMarker) this.accuracyMarker.remove();
    if (this.accuracyCircle) this.accuracyCircle.remove();
    this.accuracyMarker = L.marker([lat, lng], { icon: redIcon, interactive: false })
      .addTo(this.map);
    this.accuracyCircle = L.circle([lat, lng], {
      radius: accuracyM,
      color: '#ef4444',
      weight: 1,
      fillColor: '#ef4444',
      fillOpacity: 0.10,
    }).addTo(this.map);
  }

  /** ── Save / Cancel ─────────────────────────────── */
  save(): void {
    this.ref.close({ lat: this.pickedLat, lng: this.pickedLng });
  }

  close(): void {
    this.ref.close();
  }

  /** GPS accuracy category — drives the banner colour. */
  get accuracyBand(): 'good' | 'fair' | 'poor' | 'none' {
    if (this.gpsAccuracyMeters == null) return 'none';
    if (this.gpsAccuracyMeters <= 20) return 'good';
    if (this.gpsAccuracyMeters <= 60) return 'fair';
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
}
