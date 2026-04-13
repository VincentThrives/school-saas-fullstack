import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SelectionModel } from '@angular/cdk/collections';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models';

@Component({
  selector: 'app-id-card-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './id-card-generator.component.html',
  styleUrl: './id-card-generator.component.scss',
})
export class IdCardGeneratorComponent implements OnInit {
  userType: 'STUDENT' | 'TEACHER' = 'STUDENT';
  searchQuery = '';
  users: User[] = [];
  filteredUsers: User[] = [];
  displayedColumns = ['select', 'name', 'email', 'role'];
  selection = new SelectionModel<User>(true, []);
  isLoading = false;
  isGenerating = false;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  onUserTypeChange(): void {
    this.selection.clear();
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    const role = this.userType === 'STUDENT' ? 'STUDENT' : 'TEACHER';
    this.api.getUsers(0, 200, { role }).subscribe({
      next: (res) => {
        this.users = res.data?.content || [];
        this.applyFilter();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredUsers = this.users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }

  isAllSelected(): boolean {
    return this.selection.selected.length === this.filteredUsers.length && this.filteredUsers.length > 0;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.filteredUsers);
    }
  }

  generateIdCards(): void {
    if (this.selection.isEmpty()) return;
    this.isGenerating = true;
    const tenantId = this.authService.currentSchoolInfo?.tenantId || '';
    const userIds = this.selection.selected.map((u) => u.userId);

    if (userIds.length === 1) {
      // Single card
      const request$ = this.userType === 'STUDENT'
        ? this.api.generateStudentIdCard(userIds[0], tenantId)
        : this.api.generateTeacherIdCard(userIds[0], tenantId);

      request$.subscribe({
        next: (blob) => {
          this.downloadBlob(blob, `id-card-${this.userType.toLowerCase()}-${userIds[0]}.pdf`);
          this.isGenerating = false;
        },
        error: () => {
          this.isGenerating = false;
          this.snackBar.open('Failed to generate ID card', 'Close', { duration: 3000 });
        },
      });
    } else {
      // Bulk cards
      this.api.generateBulkIdCards(this.userType, userIds, tenantId).subscribe({
        next: (blob) => {
          this.downloadBlob(blob, `id-cards-${this.userType.toLowerCase()}-bulk.pdf`);
          this.isGenerating = false;
        },
        error: () => {
          this.isGenerating = false;
          this.snackBar.open('Failed to generate ID cards', 'Close', { duration: 3000 });
        },
      });
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open('ID card downloaded!', 'Close', { duration: 3000 });
  }
}
