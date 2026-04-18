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
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, UserRole } from '../../../core/models';

type RecipientType = 'ALL' | 'ROLE' | 'CLASS' | 'INDIVIDUAL';

interface Tab {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
}

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatRadioModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class NotificationsPageComponent implements OnInit {
  readonly tabs: Tab[] = [
    { key: 'compose',   label: 'Compose',   icon: 'edit',     enabled: true  },
    { key: 'templates', label: 'Templates', icon: 'bookmarks',enabled: true  },
    { key: 'rules',     label: 'Auto Rules',icon: 'bolt',     enabled: false },
    { key: 'history',   label: 'History',   icon: 'history',  enabled: false },
  ];
  activeTab = 'compose';

  readonly typeOptions = [
    { value: 'ANNOUNCEMENT', label: 'Announcement', icon: 'campaign'      },
    { value: 'EXAM',         label: 'Exam',         icon: 'assignment'    },
    { value: 'ATTENDANCE',   label: 'Attendance',   icon: 'event_note'    },
    { value: 'FEE',          label: 'Fee',          icon: 'payments'      },
    { value: 'GENERAL',      label: 'General',      icon: 'info'          },
    { value: 'ALERT',        label: 'Alert',        icon: 'warning'       },
  ];

  readonly roleOptions = [
    { value: UserRole.TEACHER,  label: 'Teachers' },
    { value: UserRole.STUDENT,  label: 'Students' },
    { value: UserRole.PARENT,   label: 'Parents'  },
    { value: UserRole.PRINCIPAL,label: 'Principals' },
  ];

  readonly priorityOptions = [
    { value: 'NORMAL', label: 'Normal' },
    { value: 'HIGH',   label: 'High'   },
    { value: 'URGENT', label: 'Urgent' },
  ];

  // Form state
  title = '';
  body = '';
  type = 'ANNOUNCEMENT';
  priority = 'NORMAL'; // UI-only for now
  recipientType: RecipientType = 'ALL';
  recipientRole: string = UserRole.TEACHER;
  recipientClassId = '';
  recipientSectionId = '';
  recipientUserIds: string[] = [];

  channelInApp = true;
  channelEmail = false;

  // Data
  classes: SchoolClass[] = [];
  sections: { sectionId: string; name: string }[] = [];
  isLoadingClasses = false;
  isSending = false;

  // Templates
  templates: any[] = [];
  isLoadingTemplates = false;
  templateEditorOpen = false;
  editingTemplate: any = null;
  templateForm = { name: '', title: '', body: '', type: 'ANNOUNCEMENT', defaultChannel: 'IN_APP' };
  isSavingTemplate = false;
  saveAsTemplateName = '';

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadTemplates();
  }

  // ── Templates ──────────────────────────────────────────────

  loadTemplates(): void {
    this.isLoadingTemplates = true;
    this.api.getNotificationTemplates().subscribe({
      next: (res) => {
        this.templates = res?.data || [];
        this.isLoadingTemplates = false;
      },
      error: () => { this.isLoadingTemplates = false; },
    });
  }

  openNewTemplate(): void {
    this.editingTemplate = null;
    this.templateForm = { name: '', title: '', body: '', type: 'ANNOUNCEMENT', defaultChannel: 'IN_APP' };
    this.templateEditorOpen = true;
  }

  openEditTemplate(t: any): void {
    this.editingTemplate = t;
    this.templateForm = {
      name: t.name || '',
      title: t.title || '',
      body: t.body || '',
      type: t.type || 'ANNOUNCEMENT',
      defaultChannel: t.defaultChannel || 'IN_APP',
    };
    this.templateEditorOpen = true;
  }

  closeTemplateEditor(): void {
    this.templateEditorOpen = false;
    this.editingTemplate = null;
  }

  saveTemplate(): void {
    if (!this.templateForm.name.trim() || !this.templateForm.title.trim() || !this.templateForm.body.trim()) return;
    this.isSavingTemplate = true;

    const payload = { ...this.templateForm };
    const request$ = this.editingTemplate
      ? this.api.updateNotificationTemplate(this.editingTemplate.templateId, payload)
      : this.api.createNotificationTemplate(payload);

    request$.subscribe({
      next: () => {
        this.isSavingTemplate = false;
        this.snackBar.open(this.editingTemplate ? 'Template updated' : 'Template created', 'Close', { duration: 3000 });
        this.templateEditorOpen = false;
        this.editingTemplate = null;
        this.loadTemplates();
      },
      error: (err) => {
        this.isSavingTemplate = false;
        this.snackBar.open(err?.error?.message || 'Failed to save template', 'Close', { duration: 3000 });
      },
    });
  }

  deleteTemplate(t: any): void {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    this.api.deleteNotificationTemplate(t.templateId).subscribe({
      next: () => {
        this.snackBar.open('Template deleted', 'Close', { duration: 3000 });
        this.loadTemplates();
      },
      error: () => {
        this.snackBar.open('Failed to delete template', 'Close', { duration: 3000 });
      },
    });
  }

  applyTemplate(t: any): void {
    this.title = t.title || '';
    this.body = t.body || '';
    this.type = t.type || 'ANNOUNCEMENT';
    // Map default channel onto checkboxes
    const ch = t.defaultChannel || 'IN_APP';
    this.channelInApp = ch === 'IN_APP' || ch === 'BOTH';
    this.channelEmail = ch === 'EMAIL' || ch === 'BOTH';
    this.activeTab = 'compose';
    this.snackBar.open(`Template "${t.name}" applied`, 'Close', { duration: 2500 });
  }

  saveCurrentComposeAsTemplate(): void {
    const name = (this.saveAsTemplateName || this.title || '').trim();
    if (!name || !this.title.trim() || !this.body.trim()) {
      this.snackBar.open('Enter a name, title, and body before saving', 'Close', { duration: 3000 });
      return;
    }
    this.api.createNotificationTemplate({
      name,
      title: this.title.trim(),
      body: this.body.trim(),
      type: this.type,
      defaultChannel: this.channelCode,
    }).subscribe({
      next: () => {
        this.snackBar.open(`Template "${name}" saved`, 'Close', { duration: 3000 });
        this.saveAsTemplateName = '';
        this.loadTemplates();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to save template', 'Close', { duration: 3000 });
      },
    });
  }

  loadClasses(): void {
    this.isLoadingClasses = true;
    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        this.isLoadingClasses = false;
      },
      error: () => { this.isLoadingClasses = false; },
    });
  }

  selectTab(tab: Tab): void {
    if (!tab.enabled) {
      this.snackBar.open(`${tab.label} tab coming soon`, 'Close', { duration: 2000 });
      return;
    }
    this.activeTab = tab.key;
  }

  onRecipientTypeChange(): void {
    this.recipientClassId = '';
    this.recipientSectionId = '';
    this.sections = [];
    this.recipientUserIds = [];
  }

  onClassChange(): void {
    const cls = this.classes.find(c => c.classId === this.recipientClassId);
    this.sections = (cls?.sections || []).map(s => ({ sectionId: (s as any).sectionId || '', name: s.name }));
    this.recipientSectionId = '';
  }

  get audienceLabel(): string {
    switch (this.recipientType) {
      case 'ALL':
        return 'Everyone in the school';
      case 'ROLE':
        const r = this.roleOptions.find(o => o.value === this.recipientRole);
        return r ? `All ${r.label.toLowerCase()}` : 'Specific role';
      case 'CLASS':
        const cls = this.classes.find(c => c.classId === this.recipientClassId);
        const sec = this.sections.find(s => s.sectionId === this.recipientSectionId);
        if (!cls) return 'Specific class';
        return sec ? `${cls.name} · ${sec.name}` : cls.name;
      case 'INDIVIDUAL':
        return this.recipientUserIds.length ? `${this.recipientUserIds.length} user(s)` : 'Specific users';
    }
  }

  get channelLabel(): string {
    const ch: string[] = [];
    if (this.channelInApp) ch.push('In-app');
    if (this.channelEmail) ch.push('Email');
    return ch.length ? ch.join(' + ') : 'No channel selected';
  }

  get canSend(): boolean {
    if (!this.title.trim() || !this.body.trim()) return false;
    if (!this.channelInApp && !this.channelEmail) return false;
    if (this.recipientType === 'CLASS' && !this.recipientClassId) return false;
    if (this.recipientType === 'INDIVIDUAL' && this.recipientUserIds.length === 0) return false;
    return true;
  }

  get channelCode(): string {
    if (this.channelInApp && this.channelEmail) return 'BOTH';
    if (this.channelEmail) return 'EMAIL';
    return 'IN_APP';
  }

  clearForm(): void {
    this.title = '';
    this.body = '';
    this.type = 'ANNOUNCEMENT';
    this.priority = 'NORMAL';
    this.recipientType = 'ALL';
    this.recipientRole = UserRole.TEACHER;
    this.recipientClassId = '';
    this.recipientSectionId = '';
    this.sections = [];
    this.recipientUserIds = [];
    this.channelInApp = true;
    this.channelEmail = false;
  }

  sendNow(): void {
    if (!this.canSend) return;
    this.isSending = true;

    const payload: any = {
      title: this.title.trim(),
      body: this.body.trim(),
      type: this.type,
      channel: this.channelCode,
      recipientType: this.recipientType,
    };
    if (this.recipientType === 'ROLE') payload.recipientRole = this.recipientRole;
    if (this.recipientType === 'CLASS') {
      payload.recipientClassId = this.recipientClassId;
      if (this.recipientSectionId) payload.recipientSectionId = this.recipientSectionId;
    }
    if (this.recipientType === 'INDIVIDUAL') payload.recipientIds = [...this.recipientUserIds];

    this.api.sendNotification(payload).subscribe({
      next: () => {
        this.isSending = false;
        this.snackBar.open('Notification sent', 'Close', { duration: 3000 });
        this.clearForm();
      },
      error: (err) => {
        this.isSending = false;
        this.snackBar.open(err?.error?.message || 'Failed to send notification', 'Close', { duration: 3000 });
      },
    });
  }
}
