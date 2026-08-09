import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { BiometricTerminalBinding, Student } from '../../../core/models';

@Component({
  selector: 'app-terminal-bindings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './terminal-bindings.component.html',
  styleUrl: './terminal-bindings.component.scss',
})
export class TerminalBindingsComponent implements OnInit {

  serial = '';
  bindings: BiometricTerminalBinding[] = [];
  isLoading = false;
  displayedColumns = ['terminalUserId', 'student', 'className', 'boundAt', 'actions'];

  // Add-binding form state
  newTerminalUserId = '';
  studentQuery = '';
  studentResults: Student[] = [];
  selectedStudent: Student | null = null;
  isSearching = false;
  isBinding = false;
  private searchInput$ = new Subject<string>();

  // Delete confirm
  toRemove: BiometricTerminalBinding | null = null;
  isRemoving = false;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.serial = this.route.snapshot.paramMap.get('serial') || '';
    this.load();
    // Debounced student search — a fresh page can have hundreds of
    // students; hammering the /students endpoint on every keystroke
    // would trash the tenant's Mongo cache.
    this.searchInput$.pipe(debounceTime(250), distinctUntilChanged()).subscribe(q => {
      this.performSearch(q);
    });
  }

  load(): void {
    if (!this.serial) return;
    this.isLoading = true;
    this.api.listBiometricTerminalBindings(this.serial).subscribe({
      next: (res) => {
        this.bindings = res?.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snack.open('Failed to load bindings', 'Close', { duration: 3000 });
      },
    });
  }

  onStudentQueryChange(value: string): void {
    this.studentQuery = value;
    this.searchInput$.next(value);
  }

  displayStudent = (s: Student | null): string => {
    if (!s) return '';
    const name = ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.admissionNumber;
    return `${name} (${s.admissionNumber})`;
  };

  onSelectStudent(s: Student): void {
    this.selectedStudent = s;
    this.studentQuery = this.displayStudent(s);
  }

  private performSearch(q: string): void {
    if (!q || q.trim().length < 2) {
      this.studentResults = [];
      return;
    }
    this.isSearching = true;
    this.api.getStudents(0, 15, { search: q.trim() }).subscribe({
      next: (res) => {
        this.studentResults = res?.data?.content || [];
        this.isSearching = false;
      },
      error: () => {
        this.isSearching = false;
        this.studentResults = [];
      },
    });
  }

  submitBinding(): void {
    if (!this.newTerminalUserId.trim() || !this.selectedStudent) return;
    this.isBinding = true;
    this.api.bindBiometricTerminalUser(this.serial, {
      terminalUserId: this.newTerminalUserId.trim(),
      studentId: this.selectedStudent.studentId,
    }).subscribe({
      next: () => {
        this.isBinding = false;
        this.snack.open('Student bound to terminal user id', 'Close', { duration: 2500 });
        this.newTerminalUserId = '';
        this.selectedStudent = null;
        this.studentQuery = '';
        this.studentResults = [];
        this.load();
      },
      error: (err) => {
        this.isBinding = false;
        const msg = err?.error?.message || 'Failed to save binding';
        this.snack.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  askRemove(b: BiometricTerminalBinding): void {
    this.toRemove = b;
  }

  cancelRemove(): void {
    this.toRemove = null;
  }

  confirmRemove(): void {
    if (!this.toRemove) return;
    this.isRemoving = true;
    this.api.unbindBiometricTerminalUser(this.serial, this.toRemove.terminalUserId).subscribe({
      next: () => {
        this.isRemoving = false;
        this.toRemove = null;
        this.snack.open('Binding removed', 'Close', { duration: 2500 });
        this.load();
      },
      error: () => {
        this.isRemoving = false;
        this.snack.open('Failed to remove binding', 'Close', { duration: 3000 });
      },
    });
  }

  classLabel(b: BiometricTerminalBinding): string {
    if (!b.className) return '—';
    return b.sectionName ? `${b.className} - ${b.sectionName}` : b.className;
  }
}
