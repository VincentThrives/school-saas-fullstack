import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { MyClassStudentsResponse, MyClassStudentsClass, Student } from '../../../core/models';

@Component({
  selector: 'app-my-students',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, PageHeaderComponent,
  ],
  templateUrl: './my-students.component.html',
  styleUrl: './my-students.component.scss',
})
export class MyStudentsComponent implements OnInit {
  isLoading = true;
  response: MyClassStudentsResponse | null = null;

  /** Index into response.classes when the teacher has more than one. */
  selectedClassIndex = 0;
  searchQuery = '';

  displayedColumns = ['rollNumber', 'name', 'admissionNumber', 'gender', 'dob', 'parent'];

  constructor(private api: ApiService, private router: Router) {}

  /** Navigate to per-student detail page. */
  openStudent(student: Student): void {
    if (!student?.studentId) return;
    this.router.navigate(['/my-students', student.studentId]);
  }

  ngOnInit(): void {
    this.api.getMyClassStudents().subscribe({
      next: (res) => {
        this.response = res?.data || { classTeacher: false, classes: [] };
        this.isLoading = false;
      },
      error: () => {
        this.response = { classTeacher: false, reason: 'NO_PROFILE', classes: [] };
        this.isLoading = false;
      },
    });
  }

  get hasClasses(): boolean {
    return !!this.response && this.response.classTeacher && (this.response.classes || []).length > 0;
  }

  get selectedClass(): MyClassStudentsClass | null {
    if (!this.hasClasses) return null;
    const list = this.response!.classes;
    const i = Math.min(Math.max(0, this.selectedClassIndex), list.length - 1);
    return list[i] || null;
  }

  get filteredStudents(): Student[] {
    const cls = this.selectedClass;
    if (!cls) return [];
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) return cls.students;
    return cls.students.filter(s => {
      const hay = `${s.firstName || ''} ${s.lastName || ''} ${s.admissionNumber || ''} ${s.rollNumber || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  classLabel(c: MyClassStudentsClass): string {
    const year = c.academicYearLabel ? ` · ${c.academicYearLabel}` : '';
    const sec = c.sectionName ? ` — ${c.sectionName}` : '';
    return `${c.className || 'Class'}${sec}${year}`;
  }

  studentName(s: Student): string {
    return `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.admissionNumber || '—';
  }

  studentInitial(s: Student): string {
    return (s.firstName || s.admissionNumber || '?').charAt(0).toUpperCase();
  }

  formatDate(d: string | undefined): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  }

  parentLine(s: Student): string {
    if (s.parentName) return s.parentName + (s.parentPhone ? ` · ${s.parentPhone}` : '');
    return s.parentPhone || '—';
  }
}
