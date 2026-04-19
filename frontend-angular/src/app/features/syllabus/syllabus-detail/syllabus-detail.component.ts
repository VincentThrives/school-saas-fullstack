import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Syllabus,
  SyllabusTopic,
  SyllabusTopicStatus,
  UserRole,
  Teacher,
  TeacherSubjectAssignment,
} from '../../../core/models';

@Component({
  selector: 'app-syllabus-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './syllabus-detail.component.html',
  styleUrl: './syllabus-detail.component.scss',
})
export class SyllabusDetailComponent implements OnInit {
  syllabus: Syllabus | null = null;
  topicColumns = ['index', 'topicName', 'plannedDate', 'completedDate', 'status', 'completion', 'actions'];
  isLoading = false;
  isUpdating = false;

  isAdmin = false;
  isTeacher = false;
  myTeacher: Teacher | null = null;
  myAssignments: TeacherSubjectAssignment[] = [];

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL);
    this.isTeacher = this.authService.hasRole(UserRole.TEACHER);

    if (this.isTeacher) {
      this.api.getMyTeacherProfile().subscribe({
        next: (t) => { this.myTeacher = t?.data || null; },
      });
      // Fetch this teacher's assignments across all years so canModify works
      // regardless of which year the syllabus belongs to.
      this.api.getMyTeacherAssignments().subscribe({
        next: (res) => { this.myAssignments = res?.data || []; },
        error: () => { this.myAssignments = []; },
      });
    }

    const id = this.route.snapshot.paramMap.get('syllabusId');
    if (id) this.loadSyllabus(id);
  }

  loadSyllabus(id: string): void {
    this.isLoading = true;
    this.api.getSyllabusById(id).subscribe({
      next: (res) => {
        this.syllabus = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load syllabus', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Permission ────────────────────────────────────────────────────

  get canModify(): boolean {
    if (!this.syllabus) return false;
    if (this.isAdmin) return true;
    if (!this.isTeacher || !this.myTeacher) return false;
    if (this.syllabus.teacherId && this.myTeacher.teacherId === this.syllabus.teacherId) return true;
    // New canonical source first
    const s = this.syllabus;
    const hit = (this.myAssignments || []).some(a =>
      a.classId === s.classId
      && (a.status !== 'ARCHIVED')
      && a.subjectId === s.subjectId
      && (!a.sectionId || !s.sectionId || a.sectionId === s.sectionId));
    if (hit) return true;
    // Legacy fallback
    const assigns = this.myTeacher.classSubjectAssignments || [];
    return assigns.some((a: any) =>
      a.classId === s.classId
      && (!a.sectionId || !s.sectionId || a.sectionId === s.sectionId)
      && a.subjectId === s.subjectId,
    );
  }

  // ── UI helpers ────────────────────────────────────────────────────

  getStatusClass(status: SyllabusTopicStatus): string {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'IN_PROGRESS': return 'status-in-progress';
      case 'PENDING': return 'status-pending';
      default: return '';
    }
  }

  progressColor(p: number): 'primary' | 'accent' | 'warn' {
    if (p >= 70) return 'primary';
    if (p >= 30) return 'accent';
    return 'warn';
  }

  formatDate(d: string | undefined | null): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  }

  // ── Actions ────────────────────────────────────────────────────────

  updateTopic(topic: SyllabusTopic, status: SyllabusTopicStatus, pct: number): void {
    if (!this.syllabus || !topic.topicId) return;
    this.isUpdating = true;
    this.api.updateTopicStatus(this.syllabus.syllabusId, {
      topicId: topic.topicId,
      status,
      completionPercentage: pct,
    }).subscribe({
      next: (res) => {
        this.syllabus = res.data;
        this.isUpdating = false;
      },
      error: (err) => {
        this.isUpdating = false;
        this.snackBar.open(err?.error?.message || 'Failed to update topic', 'Close', { duration: 3000 });
      },
    });
  }

  markInProgress(topic: SyllabusTopic, pct: number): void {
    this.updateTopic(topic, 'IN_PROGRESS', pct);
  }

  markComplete(topic: SyllabusTopic): void {
    this.updateTopic(topic, 'COMPLETED', 100);
  }

  resetTopic(topic: SyllabusTopic): void {
    this.updateTopic(topic, 'PENDING', 0);
  }

  editSyllabus(): void {
    if (this.syllabus) {
      this.router.navigate(['/syllabus', this.syllabus.syllabusId, 'edit']);
    }
  }

  back(): void {
    this.router.navigate(['/syllabus']);
  }
}
