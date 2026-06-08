import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  ApiService,
  SmsTemplate,
  SmsTemplateConfig,
  SmsTriggerKey,
} from '../../../../core/services/api.service';

/** UI metadata for a single trigger row in the panel. */
interface TriggerMeta {
  key: SmsTriggerKey;
  title: string;
  icon: string;
  description: string;
  sampleBody: string;
  varLabels: string[];
}

/** The hard-coded set of triggers we expose to the Super Admin. Order
 *  here drives the order of sections in the UI and the index into the
 *  parallel FormArray below. Keep in sync with backend SmsTrigger enum
 *  values — `SmsTriggerKey` is the type-level guard. */
const TRIGGERS: TriggerMeta[] = [
  {
    key: 'ABSENCE_ALERT',
    title: 'Absence Alert',
    icon: 'person_off',
    description: 'Sent to parents when a student is marked absent for the day.',
    sampleBody: 'Dear {#var#}, {#var#} was absent on {#var#}. - {#var#}',
    varLabels: ['Parent name', 'Student name', 'Date', 'School short name'],
  },
  {
    key: 'HOLIDAY_NOTICE',
    title: 'Holiday Notice',
    icon: 'beach_access',
    description: 'Broadcast announcement when the school closes for a holiday.',
    sampleBody: 'School closed from {#var#} to {#var#} for {#var#}. Reopens {#var#}. - {#var#}',
    varLabels: ['Closure date', 'Reopen date', 'Reason', 'Reopen date (again)', 'School short name'],
  },
  {
    key: 'RESULT_COMBINED',
    title: 'Result Published',
    icon: 'assessment',
    description: 'Sent when a combined result card is published for a student.',
    sampleBody: 'Hi {#var#}, the {#var#} result for {#var#} is available on the app. - {#var#}',
    varLabels: ['Parent name', 'Exam name', 'Student name', 'School short name'],
  },
  {
    key: 'CUSTOM_NOTICE',
    title: 'Custom Notice',
    icon: 'campaign',
    description: 'Free-text broadcast composed by the school admin.',
    sampleBody: '{#var#} - {#var#}',
    varLabels: ['Message', 'School short name'],
  },
];

/**
 * Per-tenant SMS templates editor, embedded inside the expanded row of
 * the Super Admin SMS Control accordion. Lazily loads the tenant's
 * stored templates and lets the admin edit any subset, saving as a
 * whole map (the upsert endpoint replaces the full document, so we
 * always send every section's current state — view-mode values + the
 * edit-mode form values for whichever section is being edited).
 *
 * UX:
 *   - One section per trigger (TRIGGERS array)
 *   - Each section toggles between view / edit independently via
 *     editingMode[trigger.key]
 *   - "Edit all" button flips every section into edit mode at once
 *   - Save flushes the full templates map and snaps every section
 *     back to view mode on success
 */
@Component({
  selector: 'app-tenant-templates-panel',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule,
    MatSnackBarModule, MatProgressSpinnerModule,
  ],
  templateUrl: './tenant-templates-panel.component.html',
  styleUrl: './tenant-templates-panel.component.scss',
})
export class TenantTemplatesPanelComponent implements OnInit, OnChanges {
  @Input() tenantId!: string;
  @Input() tenantName?: string;

  readonly TRIGGERS = TRIGGERS;

  /** Reactive form — one FormGroup per trigger, in the same order as
   *  TRIGGERS. Indexed access is fine because TRIGGERS is constant. */
  form: FormGroup;

  /** Live cache of what the backend currently has on disk for this tenant.
   *  Used to know whether each section is "configured" (drives the status
   *  pill) and to support cancel-without-reload (we just reset the form
   *  group from this snapshot). */
  templates: SmsTemplateConfig = {};

  /** Per-section view/edit toggle. False = read-only summary or empty
   *  state; true = inputs visible with Save / Cancel. */
  editingMode: Record<SmsTriggerKey, boolean> = {
    ABSENCE_ALERT: false,
    HOLIDAY_NOTICE: false,
    RESULT_COMBINED: false,
    RESULT_SINGLE: false,
    CUSTOM_NOTICE: false,
  };

  isLoading = false;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {
    this.form = this.fb.group({
      sections: this.fb.array(
        TRIGGERS.map(() => this.makeSectionGroup()),
      ),
    });
  }

  get sections(): FormArray<FormGroup> {
    return this.form.get('sections') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    if (this.tenantId) this.load();
  }

  /** Re-fetch when the parent swaps tenants without destroying the
   *  component (shouldn't happen with the current accordion, since the
   *  panel is destroyed/recreated per expansion — but cheap to be safe). */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tenantId'] && !changes['tenantId'].firstChange) {
      this.resetEditing();
      this.load();
    }
  }

  private makeSectionGroup(): FormGroup {
    return this.fb.group({
      templateId: ['', [Validators.maxLength(40)]],
      senderId:   ['', [Validators.maxLength(20)]],
      body:       ['', [Validators.maxLength(600)]],
    });
  }

  private resetEditing(): void {
    (Object.keys(this.editingMode) as SmsTriggerKey[])
      .forEach(k => this.editingMode[k] = false);
  }

  /** Pull the tenant's stored templates and patch the form. Sections
   *  without a stored template stay with empty form values; the view
   *  renders an "empty state" with an "+ Add template" button. */
  private load(): void {
    this.isLoading = true;
    this.api.getTenantSmsTemplates(this.tenantId).subscribe({
      next: (res) => {
        this.templates = res?.data ?? {};
        this.patchFormFromTemplates();
        this.isLoading = false;
      },
      error: () => {
        this.templates = {};
        this.patchFormFromTemplates();
        this.snackBar.open('Failed to load templates', 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  /** Reset every section's form group to the value in `templates`. Empty
   *  string when the tenant has no template for that trigger. */
  private patchFormFromTemplates(): void {
    TRIGGERS.forEach((t, i) => {
      const cfg = this.templates[t.key] ?? {};
      this.sections.at(i).reset({
        templateId: cfg.templateId ?? '',
        senderId:   cfg.senderId   ?? '',
        body:       cfg.body       ?? '',
      });
    });
  }

  /** Whether the tenant has a stored template for this trigger that's
   *  "complete enough" to be considered configured (both DLT id and
   *  sender header present). Drives the green/grey status pill. */
  hasTemplate(key: SmsTriggerKey): boolean {
    const t = this.templates[key];
    return !!(t?.templateId && t?.senderId);
  }

  enterEditMode(key: SmsTriggerKey): void {
    this.editingMode[key] = true;
  }

  cancelEdit(key: SmsTriggerKey): void {
    // Revert just this section's form values from the cached snapshot.
    const idx = TRIGGERS.findIndex(t => t.key === key);
    if (idx >= 0) {
      const cfg = this.templates[key] ?? {};
      this.sections.at(idx).reset({
        templateId: cfg.templateId ?? '',
        senderId:   cfg.senderId   ?? '',
        body:       cfg.body       ?? '',
      });
    }
    this.editingMode[key] = false;
  }

  /** Flip every section into edit mode at once. Useful when the Super
   *  Admin wants to swap all templates for a tenant in one pass. */
  editAll(): void {
    TRIGGERS.forEach(t => this.editingMode[t.key] = true);
  }

  /** Save flow. The upsert endpoint replaces the full templates document
   *  for the tenant, so we always build the complete map from the form's
   *  current state (covers both view-mode sections — unchanged — and
   *  edit-mode sections — possibly changed). The {@param triggerKey}
   *  argument is informational only; the payload is identical regardless
   *  of which section's Save button was clicked. */
  saveTrigger(_triggerKey: SmsTriggerKey): void {
    this.persistAll();
  }

  private persistAll(): void {
    const payload = this.buildPayload();
    this.isSaving = true;
    this.api.upsertTenantSmsTemplates(this.tenantId, payload).subscribe({
      next: (res) => {
        this.templates = res?.data ?? payload;
        this.patchFormFromTemplates();
        this.resetEditing();
        this.isSaving = false;
        this.snackBar.open('Templates saved', 'OK', { duration: 2000 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to save templates',
          'Close', { duration: 4000 },
        );
      },
    });
  }

  /** Build the templates map sent to the upsert endpoint. Empty sections
   *  (all three inputs blank) are omitted from the payload so the
   *  backend stores `null` for that trigger rather than an empty stub.
   *  varLabels are preserved from the source cache when present and
   *  copied from the trigger metadata otherwise. */
  private buildPayload(): SmsTemplateConfig {
    const out: SmsTemplateConfig = {};
    TRIGGERS.forEach((meta, i) => {
      const raw = this.sections.at(i).value as { templateId: string; senderId: string; body: string };
      const templateId = (raw.templateId || '').trim();
      const senderId   = (raw.senderId   || '').trim();
      const body       = (raw.body       || '').trim();
      if (!templateId && !senderId && !body) return;
      const existing = this.templates[meta.key];
      const tpl: SmsTemplate = {
        templateId: templateId || undefined,
        senderId:   senderId   || undefined,
        body:       body       || undefined,
        varLabels:  existing?.varLabels ?? meta.varLabels,
      };
      out[meta.key] = tpl;
    });
    return out;
  }
}
