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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationBusService } from '../../../core/services/notification-bus.service';
import { SchoolClass, UserRole, Student, Teacher } from '../../../core/models';
import { PublishResultComponent } from '../publish-result/publish-result.component';

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
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent,
    PublishResultComponent,
  ],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class NotificationsPageComponent implements OnInit {
  // Tabs are filtered by role in ngOnInit.
  tabs: Tab[] = [];
  activeTab = 'inbox';
  isAdminOrPrincipalOrTeacher = false; // can access Compose / Templates
  /** Publish Result is admin-curated — only SCHOOL_ADMIN and PRINCIPAL
   *  can fan out personalised exam results to a class and parents. */
  isAdminOrPrincipal = false;

  // Inbox state
  inbox: any[] = [];
  isLoadingInbox = false;
  /** When set, the inbox-detail popup is shown so the full title + body
   *  are readable at a comfortable size. Click anywhere on a row to open. */
  openedNotification: any = null;

  readonly typeOptions = [
    { value: 'ANNOUNCEMENT', label: 'Announcement', icon: 'campaign'      },
    { value: 'EXAM',         label: 'Exam',         icon: 'assignment'    },
    { value: 'ATTENDANCE',   label: 'Attendance',   icon: 'event_note'    },
    { value: 'HOMEWORK',     label: 'Home Work',    icon: 'menu_book'     },
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

  /** Individual-users picker sub-mode. Blank = admin hasn't chosen
   *  the source yet, so we show a small chooser instead of a giant
   *  dropdown of everyone. */
  individualPickerMode: '' | 'EMPLOYEE' | 'STUDENT' = '';

  /** Employee dropdown state. Loaded lazily on entering Employee mode. */
  pickerEmployees: Teacher[] = [];
  pickerEmployeeSelectedId = '';

  /** Student dropdown state — class + section filters drive which
   *  students appear. Selected via the picker → chip flow. */
  pickerClassId = '';
  pickerSectionId = '';
  pickerSections: { sectionId: string; name: string }[] = [];
  pickerStudents: Student[] = [];
  pickerStudentSelectedId = '';

  isLoadingPicker = false;

  /** Picked recipients — each becomes a chip below the dropdown so
   *  the admin can see who they've queued, and remove individually.
   *  These are the source of truth for the payload's recipientIds. */
  selectedRecipients: Array<{ userId: string; label: string; kind: 'EMPLOYEE' | 'STUDENT' }> = [];

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
    private authService: AuthService,
    private notificationBus: NotificationBusService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const role = this.authService.currentRole;
    this.isAdminOrPrincipalOrTeacher =
      role === UserRole.SCHOOL_ADMIN ||
      role === UserRole.PRINCIPAL ||
      role === UserRole.TEACHER;
    this.isAdminOrPrincipal =
      role === UserRole.SCHOOL_ADMIN || role === UserRole.PRINCIPAL;

    // Everyone can see Inbox. Admins/principals/teachers get Compose/etc.
    // Publish Result is admin/principal only — sits between Auto Rules
    // and History so the workflow reads left→right: write → automate →
    // publish results → look back at what you sent.
    this.tabs = [
      { key: 'inbox',     label: 'Inbox',     icon: 'inbox',     enabled: true },
      ...(this.isAdminOrPrincipalOrTeacher ? [
        { key: 'compose',   label: 'Compose',    icon: 'edit',      enabled: true },
        { key: 'templates', label: 'Templates',  icon: 'bookmarks', enabled: true },
        { key: 'rules',     label: 'Auto Rules', icon: 'bolt',      enabled: true },
      ] : []),
      ...(this.isAdminOrPrincipal ? [
        { key: 'publish',   label: 'Publish Result', icon: 'campaign', enabled: true },
      ] : []),
      ...(this.isAdminOrPrincipalOrTeacher ? [
        { key: 'history',   label: 'History',    icon: 'history',   enabled: true },
      ] : []),
    ];
    this.activeTab = 'inbox';

    this.loadInbox();
    if (this.isAdminOrPrincipalOrTeacher) {
      this.loadClasses();
      this.loadTemplates();
      this.loadRules();
      this.loadHistory();
    }
  }

  // ── Auto Rules ───────────────────────────────────────────────────

  rules: any[] = [];
  isLoadingRules = false;
  isResettingRules = false;
  readonly channelOptions = [
    { value: 'IN_APP', label: 'In-app' },
    { value: 'EMAIL',  label: 'Email' },
    { value: 'BOTH',   label: 'In-app + Email' },
  ];

  loadRules(): void {
    this.isLoadingRules = true;
    this.api.getNotificationRules().subscribe({
      next: (res) => {
        this.rules = res?.data || [];
        this.isLoadingRules = false;
      },
      error: () => { this.rules = []; this.isLoadingRules = false; },
    });
  }

  /** Save the current state of a rule (enabled/channel/template). */
  saveRule(rule: any): void {
    this.api.updateNotificationRule(rule.id, {
      enabled: !!rule.enabled,
      channel: rule.channel,
      templateId: rule.templateId || null,
    }).subscribe({
      next: () => {
        this.snackBar.open(
          `${rule.name} ${rule.enabled ? 'enabled' : 'disabled'}`,
          'Close', { duration: 2000 },
        );
      },
      error: (err) => {
        // Revert optimistic toggle on failure
        rule.enabled = !rule.enabled;
        this.snackBar.open(err?.error?.message || 'Failed to update rule', 'Close', { duration: 3000 });
      },
    });
  }

  /** Toggle switch change handler. */
  onRuleToggle(rule: any): void {
    this.saveRule(rule);
  }

  // Rules reset dialog state
  resetRulesDialogOpen = false;

  /** Open the reset-confirmation dialog (actual reset runs after confirm). */
  resetRules(): void {
    this.resetRulesDialogOpen = true;
  }
  cancelResetRules(): void {
    if (this.isResettingRules) return;
    this.resetRulesDialogOpen = false;
  }
  confirmResetRules(): void {
    this.resetRulesDialogOpen = false;
    this.isResettingRules = true;
    this.api.resetNotificationRules().subscribe({
      next: (res) => {
        this.rules = res?.data || [];
        this.isResettingRules = false;
        this.snackBar.open('Rules restored to defaults', 'Close', { duration: 2500 });
      },
      error: () => {
        this.isResettingRules = false;
        this.snackBar.open('Failed to reset rules', 'Close', { duration: 3000 });
      },
    });
  }

  getTemplateNameById(id: string | undefined | null): string {
    if (!id) return '—';
    const t = this.templates.find((x) => x.templateId === id);
    return t?.name || '—';
  }

  // ── History ─────────────────────────────────────────────────────

  history: any[] = [];
  isLoadingHistory = false;

  loadHistory(): void {
    this.isLoadingHistory = true;
    this.api.getSentNotifications(0, 50).subscribe({
      next: (res) => {
        this.history = (res?.data as any)?.content || [];
        this.isLoadingHistory = false;
      },
      error: () => { this.history = []; this.isLoadingHistory = false; },
    });
  }

  /** Audience label for a single row in the History tab. */
  historyAudienceLabel(n: any): string {
    switch (n?.recipientType) {
      case 'ALL':        return 'Everyone';
      case 'ROLE':       return `Role: ${n.recipientRole}`;
      case 'CLASS':      return 'Specific class';
      case 'INDIVIDUAL': return `${(n.recipientIds || []).length} recipient(s)`;
      default:           return '—';
    }
  }

  readCount(n: any): number {
    return (n?.readBy || []).length;
  }

  // ── Inbox (everyone) ──────────────────────────────────────────────

  loadInbox(): void {
    this.isLoadingInbox = true;
    this.api.getNotifications(0, 50).subscribe({
      next: (res) => {
        this.inbox = (res?.data as any)?.content || [];
        this.isLoadingInbox = false;
      },
      error: () => {
        this.inbox = [];
        this.isLoadingInbox = false;
      },
    });
  }

  /** Open the detail popup AND mark the row read. The inbox-item row
   *  uses the small "campaign" card style for scanning; clicking opens
   *  the full title + body in a comfortable-size dialog. */
  openNotification(n: any): void {
    this.openedNotification = n;
    this.markNotificationRead(n);
  }

  closeNotification(): void {
    this.openedNotification = null;
  }

  iconForType(type: string | undefined): string {
    switch (type) {
      case 'EXAM': return 'assignment';
      case 'ATTENDANCE': return 'event_note';
      case 'FEE': return 'payments';
      case 'ALERT': return 'warning';
      case 'ANNOUNCEMENT': return 'campaign';
      case 'HOMEWORK': return 'menu_book';
      default: return 'info';
    }
  }

  markNotificationRead(n: any): void {
    if (!n?.notificationId) return;
    const myId = this.authService.currentUser?.userId || '';
    if (n.readBy && myId && n.readBy.includes(myId)) return;
    this.api.markNotificationRead(n.notificationId).subscribe({
      next: () => {
        n.readBy = [...(n.readBy || []), myId];
        // Tell the header bell to re-fetch its unread count instantly.
        this.notificationBus.emitRefresh();
      },
    });
  }

  isUnread(n: any): boolean {
    const myId = this.authService.currentUser?.userId || '';
    return !(n?.readBy || []).includes(myId);
  }

  formatSentAt(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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

  // ── Template delete confirmation (uses the shared global .delete-overlay styles) ──
  deleteDialogOpen = false;
  templateToDelete: any = null;
  isDeletingTemplate = false;

  /** Opens the confirmation dialog. */
  deleteTemplate(t: any): void {
    if (!t?.templateId) return;
    this.templateToDelete = t;
    this.deleteDialogOpen = true;
  }

  cancelTemplateDelete(): void {
    if (this.isDeletingTemplate) return;
    this.deleteDialogOpen = false;
    this.templateToDelete = null;
  }

  confirmTemplateDelete(): void {
    const t = this.templateToDelete;
    if (!t?.templateId) return;
    this.isDeletingTemplate = true;
    this.api.deleteNotificationTemplate(t.templateId).subscribe({
      next: () => {
        this.isDeletingTemplate = false;
        this.deleteDialogOpen = false;
        this.templateToDelete = null;
        this.snackBar.open(`Template "${t.name}" deleted`, 'Close', { duration: 2500 });
        this.loadTemplates();
      },
      error: (err) => {
        this.isDeletingTemplate = false;
        this.snackBar.open(err?.error?.message || 'Failed to delete template', 'Close', { duration: 3000 });
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
    this.resetIndividualPicker();
  }

  // ── Individual users picker (Employee / Student) ──────────────

  /** Reset all sub-picker state so switching audience away from
   *  Individual doesn't leave stale employee/student picks around. */
  private resetIndividualPicker(): void {
    this.individualPickerMode = '';
    this.pickerEmployees = [];
    this.pickerEmployeeSelectedId = '';
    this.pickerClassId = '';
    this.pickerSectionId = '';
    this.pickerSections = [];
    this.pickerStudents = [];
    this.pickerStudentSelectedId = '';
    this.selectedRecipients = [];
  }

  onIndividualModeChange(): void {
    // Switching source clears the picker inputs (previously-added
    // chips stay — admin can mix employees + students in one send).
    this.pickerEmployeeSelectedId = '';
    this.pickerClassId = '';
    this.pickerSectionId = '';
    this.pickerSections = [];
    this.pickerStudents = [];
    this.pickerStudentSelectedId = '';
    if (this.individualPickerMode === 'EMPLOYEE') this.loadPickerEmployees();
  }

  loadPickerEmployees(): void {
    if (this.pickerEmployees.length > 0) return;   // already cached
    this.isLoadingPicker = true;
    // Large page — schools rarely have > a few hundred employees
    // and we want one shot at loading rather than pagination inside
    // a dropdown.
    this.api.getTeachers(0, 500).subscribe({
      next: (res) => {
        this.pickerEmployees = ((res?.data as any)?.content || [])
            .filter((e: Teacher) => !!e.userId);
        this.pickerEmployees.sort((a, b) =>
            this.employeeLabel(a).localeCompare(this.employeeLabel(b),
                undefined, { sensitivity: 'base' }));
        this.isLoadingPicker = false;
      },
      error: () => { this.pickerEmployees = []; this.isLoadingPicker = false; },
    });
  }

  onPickerClassChange(): void {
    const cls = this.classes.find(c => c.classId === this.pickerClassId);
    this.pickerSections = (cls?.sections || []).map(s => ({
      sectionId: (s as any).sectionId || '', name: s.name,
    }));
    this.pickerSectionId = '';
    this.pickerStudents = [];
    this.pickerStudentSelectedId = '';
    this.loadPickerStudents();
  }

  onPickerSectionChange(): void {
    this.pickerStudentSelectedId = '';
    this.loadPickerStudents();
  }

  loadPickerStudents(): void {
    if (!this.pickerClassId) { this.pickerStudents = []; return; }
    this.isLoadingPicker = true;
    this.api.getStudents(0, 1000, {
      classId: this.pickerClassId,
      sectionId: this.pickerSectionId || undefined,
    }).subscribe({
      next: (res) => {
        this.pickerStudents = ((res?.data as any)?.content || [])
            .filter((s: Student) => !!s.userId);
        this.pickerStudents.sort((a, b) =>
            this.studentLabel(a).localeCompare(this.studentLabel(b),
                undefined, { sensitivity: 'base' }));
        this.isLoadingPicker = false;
      },
      error: () => { this.pickerStudents = []; this.isLoadingPicker = false; },
    });
  }

  addPickedEmployee(): void {
    const uid = this.pickerEmployeeSelectedId;
    if (!uid) return;
    if (this.selectedRecipients.some(r => r.userId === uid)) {
      this.pickerEmployeeSelectedId = '';
      return;
    }
    const t = this.pickerEmployees.find(e => e.userId === uid);
    if (!t) return;
    this.selectedRecipients.push({
      userId: uid, label: this.employeeLabel(t), kind: 'EMPLOYEE',
    });
    this.pickerEmployeeSelectedId = '';   // ready for next pick
  }

  addPickedStudent(): void {
    const uid = this.pickerStudentSelectedId;
    if (!uid) return;
    if (this.selectedRecipients.some(r => r.userId === uid)) {
      this.pickerStudentSelectedId = '';
      return;
    }
    const s = this.pickerStudents.find(x => x.userId === uid);
    if (!s) return;
    this.selectedRecipients.push({
      userId: uid, label: this.studentLabel(s), kind: 'STUDENT',
    });
    this.pickerStudentSelectedId = '';
  }

  removeRecipient(userId: string): void {
    this.selectedRecipients = this.selectedRecipients.filter(r => r.userId !== userId);
  }

  employeeLabel(t: Teacher): string {
    const name = [t.firstName, t.lastName].filter(Boolean).join(' ').trim() || t.employeeId || 'Employee';
    const role = t.employeeRole ? ` · ${t.employeeRole.replace(/_/g, ' ').toLowerCase()}` : '';
    return `${name}${role}`;
  }

  studentLabel(s: Student): string {
    const name = [s.firstName, s.lastName].filter(Boolean).join(' ').trim() || s.admissionNumber || 'Student';
    const roll = s.rollNumber ? ` · #${s.rollNumber}` : '';
    return `${name}${roll}`;
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
        return this.selectedRecipients.length
            ? `${this.selectedRecipients.length} user(s)`
            : 'Specific users';
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
    if (this.recipientType === 'INDIVIDUAL' && this.selectedRecipients.length === 0) return false;
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
    this.resetIndividualPicker();
    this.channelInApp = true;
    this.channelEmail = false;
  }

  // ── Send-now confirmation popup ───────────────────────────────────
  // Open a recap dialog before firing — avoids accidental school-wide
  // broadcasts and gives the sender one last look at title + body +
  // audience before commit.
  confirmDialogOpen = false;

  /** Bound to the "Send now" button. Validates first, then opens the
   *  confirmation popup. Actual dispatch happens in {@link sendNow}
   *  when the user clicks Confirm in the popup. */
  openSendConfirm(): void {
    if (!this.canSend) return;
    this.confirmDialogOpen = true;
  }

  cancelSendConfirm(): void {
    this.confirmDialogOpen = false;
  }

  /** Friendly label for the picked type — used in the popup header. */
  get typeLabel(): string {
    return this.typeOptions.find(t => t.value === this.type)?.label || this.type;
  }

  /** Friendly label for the picked priority — used in the popup header. */
  get priorityLabel(): string {
    return this.priorityOptions.find(p => p.value === this.priority)?.label || this.priority;
  }

  sendNow(): void {
    if (!this.canSend) return;
    this.confirmDialogOpen = false;
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
    if (this.recipientType === 'INDIVIDUAL') {
      payload.recipientIds = this.selectedRecipients.map(r => r.userId);
    }

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
