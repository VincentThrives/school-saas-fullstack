import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SubjectService } from '../../../core/services/subject.service';
import { SchoolClass, Assignment } from '../../../core/models';

@Component({
  selector: 'app-assignment-form',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './assignment-form.component.html',
  styleUrl: './assignment-form.component.scss',
})
export class AssignmentFormComponent implements OnInit {
  isEdit = false;
  assignmentId = '';
  classes: SchoolClass[] = [];

  title = '';
  description = '';
  selectedClassId = '';
  selectedSectionId = '';
  selectedSubjectId = '';
  dueDate = '';
  maxMarks = 100;
  selectedFile: File | null = null;

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

    const id = this.route.snapshot.paramMap.get('assignmentId');
    if (id) {
      this.isEdit = true;
      this.assignmentId = id;
      this.loadAssignment(id);
    }
  }

  onClassOrSectionChange(): void {
    this.selectedSubjectId = '';
    this.loadSubjectsForClass();
  }

  loadSubjectsForClass(): void {
    if (!this.selectedClassId) {
      this.subjects = [];
      return;
    }
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    let subjectIds: string[] = [];

    if (this.selectedSectionId) {
      const section = cls?.sections?.find(s => s.sectionId === this.selectedSectionId);
      subjectIds = section?.subjectIds || [];
    } else {
      const allIds = new Set<string>();
      cls?.sections?.forEach(s => (s.subjectIds || []).forEach(id => allIds.add(id)));
      subjectIds = Array.from(allIds);
    }

    if (subjectIds.length === 0) {
      this.subjects = [];
      return;
    }

    this.subjectService.getSubjectsByIds(subjectIds).subscribe({
      next: (subjects) => {
        this.subjects = subjects.map(s => ({ id: s.subjectId, name: s.name }));
      },
      error: () => {
        this.subjects = [];
      },
    });
  }

  loadAssignment(id: string): void {
    this.isLoading = true;
    this.api.getAssignmentById(id).subscribe({
      next: (res) => {
        const a = res.data;
        this.title = a.title;
        this.description = a.description || '';
        this.selectedClassId = a.classId;
        this.selectedSectionId = a.sectionId || '';
        this.selectedSubjectId = a.subjectId;
        this.dueDate = a.dueDate;
        this.maxMarks = a.maxMarks;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  get selectedClass(): SchoolClass | undefined {
    return this.classes.find((c) => c.classId === this.selectedClassId);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  save(): void {
    if (!this.title || !this.selectedClassId || !this.selectedSubjectId || !this.dueDate) return;
    this.isSaving = true;

    const req = {
      title: this.title,
      description: this.description,
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId || undefined,
      subjectId: this.selectedSubjectId,
      dueDate: this.dueDate,
      maxMarks: this.maxMarks,
    };

    const obs = this.isEdit
      ? this.api.updateAssignment(this.assignmentId, req)
      : this.api.createAssignment(req);

    obs.subscribe({
      next: (res) => {
        if (this.selectedFile && res.data?.assignmentId) {
          this.api.uploadAssignmentFile(res.data.assignmentId, this.selectedFile!).subscribe({
            next: () => {
              this.isSaving = false;
              this.router.navigate(['/assignments']);
            },
            error: () => {
              this.isSaving = false;
              this.router.navigate(['/assignments']);
            },
          });
        } else {
          this.isSaving = false;
          this.router.navigate(['/assignments']);
        }
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/assignments']);
  }
}
