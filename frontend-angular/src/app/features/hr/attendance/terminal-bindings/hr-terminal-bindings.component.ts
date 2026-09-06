import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import {
  HrTerminalDto,
  HrEmployeeTerminalBinding,
  HrUnboundEmployee,
} from '../../../../core/models';
import { HrTerminalPunchesDialogComponent } from './punches-dialog/hr-terminal-punches-dialog.component';

/**
 * HR-facing Employee ↔ Terminal binding manager.
 *
 * <p>Flow: pick a terminal from the top dropdown → the table below
 * shows every employee bound to it, with inline "add" + "edit" +
 * "delete" affordances. Adding uses two dropdowns (unbound employees
 * on one side, a text input for the terminal user id on the other)
 * so HR can never accidentally bind the same employee to two
 * terminals — the unbound list excludes anyone already enrolled
 * anywhere.</p>
 *
 * <p>Wired to the {@code /api/v1/hr/attendance/bindings} endpoints,
 * which are all gated by {@code hasRole('HR')} on the backend.</p>
 */
@Component({
  selector: 'app-hr-terminal-bindings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTableModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-terminal-bindings.component.html',
  styleUrl: './hr-terminal-bindings.component.scss',
})
export class HrTerminalBindingsComponent implements OnInit {

  terminals: HrTerminalDto[] = [];
  selectedSerial: string | null = null;

  bindings: HrEmployeeTerminalBinding[] = [];
  /** Cached unbound-employees list — reloaded after every mutating
   *  action because a save/remove changes who's still unbound. */
  unbound: HrUnboundEmployee[] = [];

  displayedCols: string[] = ['userId', 'employee', 'boundAt', 'actions'];

  // ── UI state flags ─────────────────────────────
  isLoadingTerminals = false;
  isLoadingBindings = false;
  isSaving = false;

  // ── Add-binding form ───────────────────────────
  showAddForm = false;
  addEmployeeId: string | null = null;
  addTerminalUserId = '';

  // ── Edit-in-place row state ────────────────────
  /** terminalUserId of the row currently being edited, or null when
   *  no row is in edit mode. Editing the terminal-side user id is the
   *  only supported field mid-life — swapping the employee means
   *  delete + re-add. */
  editingUid: string | null = null;
  editNewUid = '';


  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadTerminals();
  }

  // ── Terminal loading ───────────────────────────

  loadTerminals(): void {
    this.isLoadingTerminals = true;
    this.api.hrListTerminals().subscribe({
      next: (res) => {
        this.terminals = res.data || [];
        this.isLoadingTerminals = false;
        // Auto-select the first terminal so the page shows content
        // immediately — HR usually has one entrance device anyway.
        if (this.terminals.length > 0 && !this.selectedSerial) {
          this.selectedSerial = this.terminals[0].terminalSerial;
          this.loadBindings();
          this.loadUnbound();
        }
      },
      error: () => {
        this.isLoadingTerminals = false;
        this.snack.open('Failed to load terminals', 'Close', { duration: 3000 });
      },
    });
  }

  onTerminalChange(): void {
    this.showAddForm = false;
    this.editingUid = null;
    this.loadBindings();
  }

  // ── Bindings loading ───────────────────────────

  loadBindings(): void {
    if (!this.selectedSerial) return;
    this.isLoadingBindings = true;
    this.api.hrListBindings(this.selectedSerial).subscribe({
      next: (res) => {
        this.bindings = res.data || [];
        this.isLoadingBindings = false;
      },
      error: () => {
        this.isLoadingBindings = false;
        this.snack.open('Failed to load bindings', 'Close', { duration: 3000 });
      },
    });
  }

  loadUnbound(): void {
    this.api.hrUnboundEmployees().subscribe({
      next: (res) => (this.unbound = res.data || []),
      // Failure here is non-fatal — the Add form just won't have a
      // populated dropdown. Surface a soft message so HR knows.
      error: () => this.snack.open(
        'Could not load unbound employees list', 'Close', { duration: 3000 }),
    });
  }

  /** Open the punches modal for the currently-selected terminal.
   *  The dialog owns its own date-picker + load lifecycle so we
   *  don't need to shuffle state up here. */
  openPunches(): void {
    if (!this.selectedSerial) return;
    const t = this.selectedTerminal();
    this.dialog.open(HrTerminalPunchesDialogComponent, {
      data: {
        serial: this.selectedSerial,
        label: t?.label ?? null,
      },
      autoFocus: false,
      panelClass: 'hr-punches-dialog-panel',
      // Pane spans the full viewport; the actual visible surface is
      // sized + centered inside via panel-class CSS. This sidesteps
      // the CDK's transform-based centering, which was leaving a
      // sub-pixel drift to the right on 375-400px phone widths.
      width: '100vw',
      maxWidth: '100vw',
    });
  }

  // ── Add flow ───────────────────────────────────

  openAddForm(): void {
    if (!this.selectedSerial) return;
    this.showAddForm = true;
    this.addEmployeeId = null;
    this.addTerminalUserId = '';
  }

  cancelAdd(): void {
    this.showAddForm = false;
  }

  saveAdd(): void {
    if (!this.selectedSerial) return;
    if (this.isSaving) return;
    if (!this.addEmployeeId) {
      this.snack.open('Pick an employee first.', 'Close', { duration: 2500 });
      return;
    }
    const uid = (this.addTerminalUserId || '').trim();
    if (!uid) {
      this.snack.open('Enter the terminal user id (PIN).', 'Close', { duration: 2500 });
      return;
    }
    this.isSaving = true;
    this.api.hrCreateBinding(this.selectedSerial, {
      terminalUserId: uid,
      employeeId: this.addEmployeeId,
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.showAddForm = false;
        this.snack.open('Binding added', 'Close', { duration: 2500 });
        this.loadBindings();
        this.loadUnbound();
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(
          err?.error?.message || 'Failed to save binding',
          'Close', { duration: 4000 });
      },
    });
  }

  // ── Edit flow ──────────────────────────────────

  startEdit(row: HrEmployeeTerminalBinding): void {
    this.editingUid = row.terminalUserId;
    this.editNewUid = row.terminalUserId;
  }

  cancelEdit(): void {
    this.editingUid = null;
    this.editNewUid = '';
  }

  saveEdit(row: HrEmployeeTerminalBinding): void {
    if (!this.selectedSerial) return;
    if (this.isSaving) return;
    const newUid = (this.editNewUid || '').trim();
    if (!newUid) {
      this.snack.open('Enter a terminal user id.', 'Close', { duration: 2500 });
      return;
    }
    if (newUid === row.terminalUserId) {
      // No-op — just leave edit mode.
      this.cancelEdit();
      return;
    }
    this.isSaving = true;
    this.api.hrUpdateBinding(this.selectedSerial, row.terminalUserId, {
      terminalUserId: newUid,
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.cancelEdit();
        this.snack.open('Terminal user id updated', 'Close', { duration: 2500 });
        this.loadBindings();
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open(
          err?.error?.message || 'Failed to update binding',
          'Close', { duration: 4000 });
      },
    });
  }

  // ── Delete flow ────────────────────────────────

  removeBinding(row: HrEmployeeTerminalBinding): void {
    if (!this.selectedSerial) return;
    // Native confirm — matches the super-admin destructive-action
    // pattern; a modal dialog would just add a click for the same
    // "are you sure?" verdict.
    const ok = window.confirm(
      `Remove binding for ${row.employeeName} (user id ${row.terminalUserId})?\n\n` +
      `Punches on this terminal will stop counting toward their attendance.`);
    if (!ok) return;
    this.api.hrDeleteBinding(this.selectedSerial, row.terminalUserId).subscribe({
      next: () => {
        this.snack.open('Binding removed', 'Close', { duration: 2500 });
        this.loadBindings();
        this.loadUnbound();
      },
      error: (err) => this.snack.open(
        err?.error?.message || 'Failed to remove',
        'Close', { duration: 3500 }),
    });
  }

  // ── Small helpers for the template ─────────────

  displayTerminal(t: HrTerminalDto): string {
    if (!t) return '';
    return t.label ? `${t.label} · ${t.terminalSerial}` : t.terminalSerial;
  }

  selectedTerminal(): HrTerminalDto | undefined {
    return this.terminals.find((t) => t.terminalSerial === this.selectedSerial);
  }

  /** Pretty-print the "5 minutes ago" bit under a terminal option. */
  ago(iso?: string): string {
    if (!iso) return 'never';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '—';
    const seconds = Math.floor((Date.now() - then) / 1000);
    if (seconds < 60)    return `${seconds}s ago`;
    if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
