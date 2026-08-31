import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import {
  EmployeeAttendanceSettings,
  UpdateAttendanceSettingsRequest,
} from '../../../../core/models';

/**
 * HR-only settings page for the Employee Attendance module.
 *
 * <p>Grouped into four sections matching the mental model of the HR
 * user:</p>
 * <ol>
 *   <li><b>Methods</b> — location, biometric, manual toggles.</li>
 *   <li><b>Location config</b> — campus coords + radius + accuracy
 *       + mock-GPS handling. Includes a "Use my current location"
 *       button so HR can sit at the school and auto-fill coords
 *       without knowing GPS numbers.</li>
 *   <li><b>Punch rules</b> — how many punches per day, late /
 *       half-day / auto-absent thresholds.</li>
 *   <li><b>Regularization</b> — the missed-punch approval workflow
 *       parameters (max backdate, monthly cap, auto-approve window).</li>
 * </ol>
 *
 * <p>Save posts the full form as a PATCH — backend only writes the
 * fields that are non-null on the request DTO, so accidental
 * unchecked-box floods can't clobber other settings.</p>
 */
@Component({
  selector: 'app-hr-attendance-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, MatSliderModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSnackBarModule, PageHeaderComponent,
  ],
  templateUrl: './hr-attendance-settings.component.html',
  styleUrl: './hr-attendance-settings.component.scss',
})
export class HrAttendanceSettingsComponent implements OnInit {

  settings: EmployeeAttendanceSettings = this.blank();
  isLoading = false;
  isSaving = false;
  isSavingLocation = false;
  isLocating = false;
  /** Set true after Use current location fills the coords so the
   *  inline "Save location now" button shines. Reset on any full
   *  save or reload. */
  locationJustCaptured = false;

  /** Punch options — 1 or 2 covers 99% of cases. Higher values
   *  (4 punches for split-shift) reserved for future without UI. */
  punchOptions = [
    { value: 1, label: '1 punch — IN only' },
    { value: 2, label: '2 punches — IN + OUT' },
  ];

  /** Which pane is active in the settings side-nav. Each pane
   *  contains EVERYTHING related to that topic — the enable toggle
   *  AND the config fields — so admin never has to hop between
   *  sections to change one thing. */
  activeSection: 'location' | 'biometric' | 'punch' | 'regularization' = 'location';

  /** Settings side-nav — one entry per section. Order chosen so the
   *  two marking methods are on top (that's the "what shape does
   *  attendance take" decision), then rules, then the workflow. */
  readonly sections: ReadonlyArray<{
    id: 'location' | 'biometric' | 'punch' | 'regularization';
    label: string;
    icon: string;
    hint: string;
  }> = [
    { id: 'location',       label: 'Location marking', icon: 'location_on',          hint: 'Phone GPS + campus radius' },
    { id: 'biometric',      label: 'Biometric terminal', icon: 'fingerprint',        hint: 'eSSL scanner + bindings' },
    { id: 'punch',          label: 'Punch rules',      icon: 'schedule',             hint: 'Timings + auto-absent' },
    { id: 'regularization', label: 'Regularization',   icon: 'assignment_turned_in', hint: 'Missed-punch approvals' },
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  /** "Set up bindings" button on the Biometric pane. Navigates to
   *  the HR bindings page (placeholder for now — full CRUD lands
   *  in Phase 1b). */
  openTerminalBindings(): void {
    this.router.navigate(['/hr/attendance/terminal-bindings']);
  }

  ngOnInit(): void {
    this.load();
  }

  private blank(): EmployeeAttendanceSettings {
    return {
      locationBasedEnabled: false,
      biometricBasedEnabled: false,
      allowedRadiusMeters: 200,
      rejectMockLocations: true,
      maxAccuracyMeters: 100,
      expectedPunchesPerDay: 2,
      lateThreshold: '09:15',
      halfDayThreshold: '11:00',
      autoAbsentTime: '11:00',
      autoAbsentEnabled: false,
      regularizationEnabled: true,
      regularizationMaxBackdateDays: 7,
      regularizationMonthlyCapPerEmployee: 3,
      regularizationAutoApproveWindowMinutes: 30,
    };
  }

  load(): void {
    this.isLoading = true;
    this.api.hrGetAttendanceSettings().subscribe({
      next: (res) => {
        if (res.data) this.settings = { ...this.blank(), ...res.data };
        this.isLoading = false;
      },
      error: () => {
        this.snack.open('Failed to load settings', 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  /**
   * Uses the browser's Geolocation API to fill in the campus lat/lng
   * with the admin's current position. Meant for the common flow
   * where HR sits at the school reception with a laptop and clicks
   * this button once at setup time.
   */
  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.snack.open('Your browser doesn\'t support location.', 'Close', { duration: 3500 });
      return;
    }
    this.isLocating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.settings.campusLatitude  = +pos.coords.latitude.toFixed(6);
        this.settings.campusLongitude = +pos.coords.longitude.toFixed(6);
        this.isLocating = false;
        this.locationJustCaptured = true;
        this.snack.open(
          `Location captured (accuracy ${Math.round(pos.coords.accuracy)}m). Click "Save location" to confirm.`,
          'Close', { duration: 4000 });
      },
      (err) => {
        this.isLocating = false;
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Enable it in your browser.'
          : 'Couldn\'t get your location. Try again in an open area.';
        this.snack.open(msg, 'Close', { duration: 4500 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  /**
   * Location-only quick save — fires after "Use my current location"
   * so admin can lock in the campus coords without hunting for the
   * main "Save settings" button at the bottom. Sends a targeted
   * PATCH with just the location fields; backend's non-null-only
   * update logic leaves every other setting alone.
   */
  saveLocationOnly(): void {
    if (this.isSavingLocation) return;
    if (this.settings.campusLatitude == null || this.settings.campusLongitude == null) {
      this.snack.open('Capture your location first.', 'Close', { duration: 3000 });
      return;
    }
    this.isSavingLocation = true;
    this.api.hrUpdateAttendanceSettings({
      campusLatitude:  this.settings.campusLatitude,
      campusLongitude: this.settings.campusLongitude,
      // Also flip locationBasedEnabled ON if it's off — the admin
      // just picked a location, they clearly want the feature enabled.
      locationBasedEnabled: true,
    }).subscribe({
      next: (res) => {
        this.settings = { ...this.blank(), ...res.data };
        this.isSavingLocation = false;
        this.locationJustCaptured = false;
        this.snack.open('Campus location saved', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSavingLocation = false;
        this.snack.open(err?.error?.message || 'Failed to save location', 'Close', { duration: 3500 });
      },
    });
  }

  save(): void {
    if (this.isSaving) return;
    this.locationJustCaptured = false;
    // Basic validation before hitting backend
    if (this.settings.locationBasedEnabled
        && (this.settings.campusLatitude == null || this.settings.campusLongitude == null)) {
      this.snack.open(
        'Location marking is on but campus location isn\'t set. Click "Use my current location" first.',
        'Close', { duration: 5000 });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(this.settings.lateThreshold || '')
        || !/^\d{2}:\d{2}$/.test(this.settings.halfDayThreshold || '')
        || !/^\d{2}:\d{2}$/.test(this.settings.autoAbsentTime || '')) {
      this.snack.open('Thresholds must be in HH:MM format.', 'Close', { duration: 3500 });
      return;
    }

    this.isSaving = true;
    const req: UpdateAttendanceSettingsRequest = {
      locationBasedEnabled:   this.settings.locationBasedEnabled,
      biometricBasedEnabled:  this.settings.biometricBasedEnabled,
      campusLatitude:         this.settings.campusLatitude,
      campusLongitude:        this.settings.campusLongitude,
      allowedRadiusMeters:    this.settings.allowedRadiusMeters,
      rejectMockLocations:    this.settings.rejectMockLocations,
      maxAccuracyMeters:      this.settings.maxAccuracyMeters,
      expectedPunchesPerDay:  this.settings.expectedPunchesPerDay,
      lateThreshold:          this.settings.lateThreshold,
      halfDayThreshold:       this.settings.halfDayThreshold,
      autoAbsentTime:         this.settings.autoAbsentTime,
      autoAbsentEnabled:      this.settings.autoAbsentEnabled,
      regularizationEnabled:  this.settings.regularizationEnabled,
      regularizationMaxBackdateDays:           this.settings.regularizationMaxBackdateDays,
      regularizationMonthlyCapPerEmployee:     this.settings.regularizationMonthlyCapPerEmployee,
      regularizationAutoApproveWindowMinutes:  this.settings.regularizationAutoApproveWindowMinutes,
    };
    this.api.hrUpdateAttendanceSettings(req).subscribe({
      next: (res) => {
        this.settings = { ...this.blank(), ...res.data };
        this.isSaving = false;
        this.snack.open('Settings saved', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(err?.error?.message || 'Failed to save', 'Close', { duration: 3500 });
      },
    });
  }
}
