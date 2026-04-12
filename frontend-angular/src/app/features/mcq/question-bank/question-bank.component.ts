import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';

interface Question {
  questionId: string;
  subjectId: string;
  subjectName?: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

@Component({
  selector: 'app-question-bank',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './question-bank.component.html',
  styleUrl: './question-bank.component.scss',
})
export class QuestionBankComponent implements OnInit {
  questions: Question[] = [];
  displayedColumns = ['questionText', 'subject', 'difficulty', 'options', 'actions'];
  isLoading = false;
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;

  subjectFilter = '';
  difficultyFilter = '';

  // Dialog state
  showDialog = false;
  showDeleteDialog = false;
  selectedQuestion: Question | null = null;
  questionForm!: FormGroup;
  isSaving = false;

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadQuestions();
  }

  private initForm(): void {
    this.questionForm = this.fb.group({
      subjectId: ['', Validators.required],
      questionText: ['', Validators.required],
      option1: ['', Validators.required],
      option2: ['', Validators.required],
      option3: ['', Validators.required],
      option4: ['', Validators.required],
      correctOptionIndex: [0],
      difficulty: ['MEDIUM'],
    });
  }

  loadQuestions(): void {
    this.isLoading = true;
    // Using getExams as placeholder for question bank API
    this.api.getExams().subscribe({
      next: () => {
        this.questions = [];
        this.totalElements = 0;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  getDifficultyClass(difficulty: string): string {
    switch (difficulty) {
      case 'EASY': return 'difficulty-easy';
      case 'MEDIUM': return 'difficulty-medium';
      case 'HARD': return 'difficulty-hard';
      default: return '';
    }
  }

  openAddDialog(): void {
    this.selectedQuestion = null;
    this.questionForm.reset({
      subjectId: '',
      questionText: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correctOptionIndex: 0,
      difficulty: 'MEDIUM',
    });
    this.showDialog = true;
  }

  openEditDialog(question: Question): void {
    this.selectedQuestion = question;
    this.questionForm.patchValue({
      subjectId: question.subjectId,
      questionText: question.questionText,
      option1: question.options[0] || '',
      option2: question.options[1] || '',
      option3: question.options[2] || '',
      option4: question.options[3] || '',
      correctOptionIndex: question.correctOptionIndex,
      difficulty: question.difficulty,
    });
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.selectedQuestion = null;
  }

  saveQuestion(): void {
    if (this.questionForm.invalid) return;
    this.isSaving = true;

    // Simulate save
    setTimeout(() => {
      this.isSaving = false;
      this.showDialog = false;
      this.snackBar.open(
        this.selectedQuestion ? 'Question updated successfully' : 'Question created successfully',
        'Close',
        { duration: 3000 },
      );
      this.loadQuestions();
    }, 1000);
  }

  openDeleteDialog(question: Question): void {
    this.selectedQuestion = question;
    this.showDeleteDialog = true;
  }

  confirmDelete(): void {
    this.showDeleteDialog = false;
    this.snackBar.open('Question deleted successfully', 'Close', { duration: 3000 });
    this.loadQuestions();
  }

  cancelDelete(): void {
    this.showDeleteDialog = false;
    this.selectedQuestion = null;
  }
}
