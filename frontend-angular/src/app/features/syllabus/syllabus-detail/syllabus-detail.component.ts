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
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Syllabus, SyllabusTopic, SyllabusTopicStatus } from '../../../core/models';

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
    PageHeaderComponent,
  ],
  templateUrl: './syllabus-detail.component.html',
  styleUrl: './syllabus-detail.component.scss',
})
export class SyllabusDetailComponent implements OnInit {
  syllabus: Syllabus | null = null;
  topicColumns = ['topicName', 'plannedDate', 'status', 'completion', 'actions'];
  isLoading = false;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('syllabusId');
    if (id) {
      this.loadSyllabus(id);
    }
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
      },
    });
  }

  getStatusClass(status: SyllabusTopicStatus): string {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'IN_PROGRESS': return 'status-in-progress';
      case 'PENDING': return 'status-pending';
      default: return '';
    }
  }

  markInProgress(topic: SyllabusTopic): void {
    if (!this.syllabus) return;
    this.api.updateTopicStatus(this.syllabus.syllabusId, {
      topicId: topic.topicId,
      status: 'IN_PROGRESS',
      completionPercentage: 50,
    }).subscribe({
      next: (res) => {
        this.syllabus = res.data;
      },
    });
  }

  markComplete(topic: SyllabusTopic): void {
    if (!this.syllabus) return;
    this.api.updateTopicStatus(this.syllabus.syllabusId, {
      topicId: topic.topicId,
      status: 'COMPLETED',
      completionPercentage: 100,
    }).subscribe({
      next: (res) => {
        this.syllabus = res.data;
      },
    });
  }

  editSyllabus(): void {
    if (this.syllabus) {
      this.router.navigate(['/syllabus', this.syllabus.syllabusId, 'edit']);
    }
  }
}
