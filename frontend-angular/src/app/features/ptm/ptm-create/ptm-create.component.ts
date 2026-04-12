import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SelectionModel } from '@angular/cdk/collections';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { Teacher } from '../../../core/models';

@Component({
  selector: 'app-ptm-create',
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
    MatCheckboxModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './ptm-create.component.html',
  styleUrl: './ptm-create.component.scss',
})
export class PtmCreateComponent implements OnInit {
  title = '';
  date = '';
  startTime = '';
  endTime = '';
  slotDuration = 15;
  location = '';

  teachers: Teacher[] = [];
  teacherSelection = new SelectionModel<Teacher>(true, []);
  isLoading = false;
  isSaving = false;

  slotDurations = [
    { value: 10, label: '10 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 20, label: '20 minutes' },
    { value: 30, label: '30 minutes' },
  ];

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.isLoading = true;
    this.api.getTeachers(0, 200).subscribe({
      next: (res) => {
        this.teachers = res.data?.content || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  isAllTeachersSelected(): boolean {
    return this.teacherSelection.selected.length === this.teachers.length && this.teachers.length > 0;
  }

  toggleAllTeachers(): void {
    if (this.isAllTeachersSelected()) {
      this.teacherSelection.clear();
    } else {
      this.teacherSelection.select(...this.teachers);
    }
  }

  save(): void {
    if (!this.title || !this.date || !this.startTime || !this.endTime || this.teacherSelection.isEmpty()) return;
    this.isSaving = true;

    this.api.createPtm({
      title: this.title,
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      slotDuration: this.slotDuration,
      location: this.location,
      teacherIds: this.teacherSelection.selected.map((t) => t.teacherId),
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigate(['/ptm']);
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/ptm']);
  }
}
