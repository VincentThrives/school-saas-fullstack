import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';
import { SchoolClass, AcademicYear, Syllabus } from '../../../core/models';

interface TopicRow {
  topicName: string;
  description: string;
  plannedDate: string;
}

@Component({
  selector: 'app-syllabus-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './syllabus-form.component.html',
  styleUrl: './syllabus-form.component.scss',
})
export class SyllabusFormComponent implements OnInit {
  isEdit = false;
  syllabusId = '';
  classes: SchoolClass[] = [];
  academicYears: AcademicYear[] = [];

  selectedClassId = '';
  selectedSubjectId = '';
  selectedAcademicYearId = '';

  topics: TopicRow[] = [{ topicName: '', description: '', plannedDate: '' }];

  isLoading = false;
  isSaving = false;

  subjects: { id: string; name: string }[] = [];

  constructor(
    private api: ApiService,
    private subjectService: SubjectService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe((res) => {
      this.classes = res.data || [];
    });
    this.api.getAcademicYears().subscribe((res) => {
      this.academicYears = res.data || [];
      const current = this.academicYears.find((ay) => ay.current);
      if (current) this.selectedAcademicYearId = current.academicYearId;
    });

    const id = this.route.snapshot.paramMap.get('syllabusId');
    if (id) {
      this.isEdit = true;
      this.syllabusId = id;
      this.loadSyllabus(id);
    }
  }

  onClassOrYearChange(): void {
    this.selectedSubjectId = '';
    this.loadSubjectsForClass();
  }

  loadSubjectsForClass(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) {
      this.subjects = [];
      return;
    }
    this.subjectService.getSubjectsByClassAndYear(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (subjects) => {
        this.subjects = subjects.map(s => ({ id: s.subjectId, name: s.name }));
      },
      error: () => {
        this.subjects = [];
      },
    });
  }

  loadSyllabus(id: string): void {
    this.isLoading = true;
    this.api.getSyllabusById(id).subscribe({
      next: (res) => {
        const s = res.data;
        this.selectedClassId = s.classId;
        this.selectedSubjectId = s.subjectId;
        this.selectedAcademicYearId = s.academicYearId;
        this.topics = s.topics.map((t) => ({
          topicName: t.topicName,
          description: t.description || '',
          plannedDate: t.plannedDate || '',
        }));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  addTopic(): void {
    this.topics.push({ topicName: '', description: '', plannedDate: '' });
  }

  removeTopic(index: number): void {
    if (this.topics.length > 1) {
      this.topics.splice(index, 1);
    }
  }

  save(): void {
    const validTopics = this.topics.filter((t) => t.topicName.trim());
    if (!this.selectedClassId || !this.selectedSubjectId || validTopics.length === 0) return;

    this.isSaving = true;
    const req = {
      classId: this.selectedClassId,
      subjectId: this.selectedSubjectId,
      academicYearId: this.selectedAcademicYearId,
      topics: validTopics,
    };

    const obs = this.isEdit
      ? this.api.updateSyllabus(this.syllabusId, req)
      : this.api.createSyllabus(req);

    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigate(['/syllabus']);
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/syllabus']);
  }
}
