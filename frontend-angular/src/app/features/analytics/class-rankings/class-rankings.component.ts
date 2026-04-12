import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, ClassRanking } from '../../../core/models';

@Component({
  selector: 'app-class-rankings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './class-rankings.component.html',
  styleUrl: './class-rankings.component.scss',
})
export class ClassRankingsComponent implements OnInit {
  classes: SchoolClass[] = [];
  exams: { id: string; name: string }[] = [];
  selectedClassId = '';
  selectedExamId = '';
  rankings: ClassRanking[] = [];
  displayedColumns = ['rank', 'studentName', 'rollNumber', 'totalMarks', 'percentage'];
  isLoading = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
    });
    this.api.getExams().subscribe((res) => {
      this.exams = (res.data || []).map((e: any) => ({
        id: e.examId || e.id,
        name: e.examName || e.name || e.title,
      }));
    });
  }

  loadRankings(): void {
    if (!this.selectedClassId) return;
    this.isLoading = true;
    this.api.getClassRankings(this.selectedClassId, this.selectedExamId || undefined).subscribe({
      next: (res) => {
        this.rankings = res.data || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  getMedalIcon(rank: number): string {
    switch (rank) {
      case 1: return 'emoji_events';
      case 2: return 'military_tech';
      case 3: return 'workspace_premium';
      default: return '';
    }
  }

  getMedalClass(rank: number): string {
    switch (rank) {
      case 1: return 'gold-medal';
      case 2: return 'silver-medal';
      case 3: return 'bronze-medal';
      default: return '';
    }
  }
}
