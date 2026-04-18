import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface SchoolProfile {
  displayName?: string; tagline?: string; logoUrl?: string;
  contactEmail?: string; contactPhone?: string; website?: string;
  principalName?: string; boardAffiliation?: string;
  establishedYear?: number | null;
  addressLine1?: string; addressLine2?: string;
  city?: string; state?: string; country?: string; zip?: string;
}

interface GradingBand {
  grade: string;
  minPercent: number | null;
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireSpecialChar: boolean;
  expiryDays: number;
}

interface SettingsTab {
  key: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatDividerModule, MatTooltipModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  readonly tabs: SettingsTab[] = [
    { key: 'profile',    label: 'School Profile',    icon: 'apartment'   },
    { key: 'academic',   label: 'Academic',          icon: 'school'      },
    { key: 'attendance', label: 'Attendance',        icon: 'event_note'  },
    { key: 'fees',       label: 'Fees',              icon: 'payments'    },
    { key: 'ids',        label: 'ID Formats',        icon: 'badge'       },
    { key: 'security',   label: 'Security',          icon: 'security'    },
    { key: 'features',   label: 'Features & Limits', icon: 'tune'        },
  ];
  activeTab = 'profile';

  readonly boardOptions = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'NIOS', 'Other'];
  readonly currencyOptions = [
    { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
    { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
    { code: 'EUR', symbol: '€', label: 'Euro (€)' },
    { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
    { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
    { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
    { code: 'LKR', symbol: 'Rs', label: 'Sri Lankan Rupee' },
  ];
  readonly monthOptions = [
    { v: 1,  n: 'January' },  { v: 2,  n: 'February' },{ v: 3,  n: 'March' },
    { v: 4,  n: 'April' },    { v: 5,  n: 'May' },     { v: 6,  n: 'June' },
    { v: 7,  n: 'July' },     { v: 8,  n: 'August' },  { v: 9,  n: 'September' },
    { v: 10, n: 'October' },  { v: 11, n: 'November' },{ v: 12, n: 'December' },
  ];
  readonly defaultGradingScale: GradingBand[] = [
    { grade: 'A+', minPercent: 90 }, { grade: 'A', minPercent: 80 },
    { grade: 'B+', minPercent: 70 }, { grade: 'B', minPercent: 60 },
    { grade: 'C',  minPercent: 50 }, { grade: 'D', minPercent: 35 },
    { grade: 'F',  minPercent: 0  },
  ];

  // Raw settings object from API — mutated then saved back
  settings: any = null;
  isLoading = false;
  isSaving = false;
  dirty = false;

  // Profile (editable clone)
  profile: SchoolProfile = {};

  // Academic
  academicDraft = {
    defaultPassingMarksPercent: 35 as number,
    percentageRoundOff: 0 as number,
    sessionStartMonth: 4 as number,
    sessionEndMonth: 3 as number,
    gradingScale: [] as GradingBand[],
  };

  // Attendance
  attendanceDraft = {
    attendanceWindowHours: 2 as number,
    lateThresholdMinutes: 15 as number,
    schoolStartTime: '' as string,
    schoolEndTime: '' as string,
  };

  // Fees
  feesDraft = {
    currencyCode: 'INR' as string,
    currencySymbol: '₹' as string,
    invoicePrefix: 'INV-' as string,
    feeGracePeriodDays: 7 as number,
    lateFinePerDay: null as number | null,
    partialPaymentAllowed: false as boolean,
  };

  // IDs
  idDraft = {
    admissionNumberFormat: '' as string,
    rollNumberFormat: '' as string,
    employeeIdFormat: '' as string,
  };

  // Security
  securityDraft = {
    maxLoginAttempts: 5 as number,
    sessionTimeoutMinutes: 60 as number,
    passwordPolicy: { minLength: 8, requireUppercase: true, requireSpecialChar: true, expiryDays: 90 } as PasswordPolicy,
  };

  // Features & Limits (read-only, sourced from auth context)
  featureFlags: { key: string; enabled: boolean; label: string }[] = [];
  limitsInfo: { maxStudents?: number; maxUsers?: number; storageGb?: number } | null = null;
  planName = '';

  get logoInitial(): string {
    const n = (this.profile?.displayName || '').trim();
    return n ? n.charAt(0).toUpperCase() : 'S';
  }

  get addressPreview(): string {
    const p = this.profile || {};
    const parts = [p.addressLine1, p.addressLine2, p.city, p.state, p.zip, p.country].filter(Boolean);
    return parts.join(', ');
  }

  // Live previews for ID formats
  previewFormat(pattern: string): string {
    if (!pattern) return '';
    const year = new Date().getFullYear();
    return pattern
      .replace(/\{YEAR\}/gi, String(year))
      .replace(/\{YY\}/gi, String(year).slice(-2))
      .replace(/#{1,}/g, (m) => String(1).padStart(m.length, '0'));
  }

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadFeaturesAndLimits();
  }

  loadSettings(): void {
    this.isLoading = true;
    this.api.getSettings().subscribe({
      next: (res) => {
        this.settings = res?.data || {};
        this.hydrateDrafts();
        this.dirty = false;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load settings', 'Close', { duration: 3000 });
      },
    });
  }

  private hydrateDrafts(): void {
    const s = this.settings || {};
    this.profile = { ...(s.profile || {}) };

    this.academicDraft = {
      defaultPassingMarksPercent: s.defaultPassingMarksPercent ?? 35,
      percentageRoundOff: s.percentageRoundOff ?? 0,
      sessionStartMonth: s.sessionStartMonth ?? 4,
      sessionEndMonth: s.sessionEndMonth ?? 3,
      gradingScale: Array.isArray(s.gradingScale) && s.gradingScale.length > 0
        ? s.gradingScale.map((g: any) => ({ grade: g.grade || '', minPercent: g.minPercent ?? null }))
        : [...this.defaultGradingScale],
    };

    this.attendanceDraft = {
      attendanceWindowHours: s.attendanceWindowHours ?? 2,
      lateThresholdMinutes: s.lateThresholdMinutes ?? 15,
      schoolStartTime: s.schoolStartTime ?? '08:30',
      schoolEndTime: s.schoolEndTime ?? '15:30',
    };

    this.feesDraft = {
      currencyCode: s.currencyCode ?? 'INR',
      currencySymbol: s.currencySymbol ?? '₹',
      invoicePrefix: s.invoicePrefix ?? 'INV-',
      feeGracePeriodDays: s.feeGracePeriodDays ?? 7,
      lateFinePerDay: s.lateFinePerDay ?? null,
      partialPaymentAllowed: !!s.partialPaymentAllowed,
    };

    this.idDraft = {
      admissionNumberFormat: s.admissionNumberFormat ?? '{YEAR}-####',
      rollNumberFormat: s.rollNumberFormat ?? '##',
      employeeIdFormat: s.employeeIdFormat ?? 'EMP-####',
    };

    this.securityDraft = {
      maxLoginAttempts: s.maxLoginAttempts ?? 5,
      sessionTimeoutMinutes: s.sessionTimeoutMinutes ?? 60,
      passwordPolicy: {
        minLength:          s.passwordPolicy?.minLength          ?? 8,
        requireUppercase:   !!(s.passwordPolicy?.requireUppercase ?? true),
        requireSpecialChar: !!(s.passwordPolicy?.requireSpecialChar ?? true),
        expiryDays:         s.passwordPolicy?.expiryDays         ?? 90,
      },
    };
  }

  private loadFeaturesAndLimits(): void {
    const info = this.authService.currentSchoolInfo as any;
    const flags: Record<string, boolean> = info?.featureFlags || {};
    const labels: Record<string, string> = {
      attendance: 'Attendance',
      timetable: 'Timetable',
      exams: 'Exams',
      mcq: 'MCQ Exams',
      fee: 'Fee Management',
      events: 'Events & Holidays',
      notifications: 'Notifications',
      whatsapp: 'WhatsApp Messaging',
      report_cards: 'Report Cards',
      analytics: 'Analytics',
      content: 'Study Materials',
      messaging: 'Messaging',
    };
    this.featureFlags = Object.keys(labels).map(k => ({
      key: k,
      enabled: !!flags[k],
      label: labels[k],
    }));
    this.limitsInfo = info?.limits || null;
    this.planName = info?.plan || 'Standard';
  }

  selectTab(tab: SettingsTab): void {
    this.activeTab = tab.key;
  }

  markDirty(): void {
    this.dirty = true;
  }

  resetActiveTab(): void {
    this.hydrateDrafts();
    this.dirty = false;
  }

  saveActiveTab(): void {
    if (!this.settings) return;
    this.isSaving = true;

    // Build full payload preserving other fields, then layer in the drafts
    const payload: any = {
      ...this.settings,
      profile: { ...this.profile },

      // Academic
      defaultPassingMarksPercent: this.academicDraft.defaultPassingMarksPercent,
      percentageRoundOff: this.academicDraft.percentageRoundOff,
      sessionStartMonth: this.academicDraft.sessionStartMonth,
      sessionEndMonth: this.academicDraft.sessionEndMonth,
      gradingScale: this.academicDraft.gradingScale
        .filter(g => g.grade && g.minPercent !== null)
        .map(g => ({ grade: g.grade, minPercent: Number(g.minPercent) })),

      // Attendance
      attendanceWindowHours: this.attendanceDraft.attendanceWindowHours,
      lateThresholdMinutes: this.attendanceDraft.lateThresholdMinutes,
      schoolStartTime: this.attendanceDraft.schoolStartTime,
      schoolEndTime: this.attendanceDraft.schoolEndTime,

      // Fees
      currencyCode: this.feesDraft.currencyCode,
      currencySymbol: this.feesDraft.currencySymbol,
      invoicePrefix: this.feesDraft.invoicePrefix,
      feeGracePeriodDays: this.feesDraft.feeGracePeriodDays,
      lateFinePerDay: this.feesDraft.lateFinePerDay,
      partialPaymentAllowed: this.feesDraft.partialPaymentAllowed,

      // IDs
      admissionNumberFormat: this.idDraft.admissionNumberFormat,
      rollNumberFormat: this.idDraft.rollNumberFormat,
      employeeIdFormat: this.idDraft.employeeIdFormat,

      // Security
      maxLoginAttempts: this.securityDraft.maxLoginAttempts,
      sessionTimeoutMinutes: this.securityDraft.sessionTimeoutMinutes,
      passwordPolicy: { ...this.securityDraft.passwordPolicy },
    };

    this.api.updateSettings(payload).subscribe({
      next: (res) => {
        this.settings = res?.data || payload;
        this.hydrateDrafts();
        this.dirty = false;
        this.isSaving = false;
        this.snackBar.open('Settings saved', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Failed to save', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Grading scale helpers ──────────────────────────────────
  addGradingBand(): void {
    this.academicDraft.gradingScale.push({ grade: '', minPercent: null });
    this.markDirty();
  }
  removeGradingBand(i: number): void {
    this.academicDraft.gradingScale.splice(i, 1);
    this.markDirty();
  }
  resetGradingDefaults(): void {
    this.academicDraft.gradingScale = [...this.defaultGradingScale];
    this.markDirty();
  }

  // ── Currency helper ────────────────────────────────────────
  onCurrencyCodeChange(): void {
    const match = this.currencyOptions.find(c => c.code === this.feesDraft.currencyCode);
    if (match) this.feesDraft.currencySymbol = match.symbol;
    this.markDirty();
  }
}
