import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface ExamQuestion {
  questionId: string;
  questionText: string;
  options: string[];
}

@Component({
  selector: 'app-take-mcq-exam',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatChipsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './take-mcq-exam.component.html',
  styleUrl: './take-mcq-exam.component.scss',
})
export class TakeMcqExamComponent implements OnInit, OnDestroy {
  examId = '';
  state: 'start' | 'exam' | 'result' = 'start';

  questions: ExamQuestion[] = [];
  currentIndex = 0;
  answers: Map<string, number> = new Map();
  timeRemaining = 0;
  timerInterval: any = null;

  // Result
  score = 0;
  totalQuestions = 0;
  correctAnswers = 0;
  percentage = 0;

  showSubmitDialog = false;
  isStarting = false;
  isSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.examId = this.route.snapshot.paramMap.get('examId') || '';
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  startExam(): void {
    this.isStarting = true;
    // Simulate starting exam with mock data
    setTimeout(() => {
      this.questions = [
        { questionId: '1', questionText: 'Sample Question 1', options: ['Option A', 'Option B', 'Option C', 'Option D'] },
        { questionId: '2', questionText: 'Sample Question 2', options: ['Option A', 'Option B', 'Option C', 'Option D'] },
        { questionId: '3', questionText: 'Sample Question 3', options: ['Option A', 'Option B', 'Option C', 'Option D'] },
      ];
      this.timeRemaining = 30 * 60; // 30 minutes
      this.state = 'exam';
      this.isStarting = false;
      this.startTimer();
    }, 1000);
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.submitExam();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  get formattedTime(): string {
    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  get currentQuestion(): ExamQuestion | null {
    return this.questions[this.currentIndex] || null;
  }

  get currentAnswer(): number | undefined {
    return this.currentQuestion ? this.answers.get(this.currentQuestion.questionId) : undefined;
  }

  get answeredCount(): number {
    return this.answers.size;
  }

  get progress(): number {
    return this.questions.length > 0 ? (this.answeredCount / this.questions.length) * 100 : 0;
  }

  selectAnswer(optionIndex: number): void {
    if (this.currentQuestion) {
      this.answers.set(this.currentQuestion.questionId, optionIndex);
    }
  }

  previousQuestion(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  nextQuestion(): void {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    }
  }

  goToQuestion(index: number): void {
    this.currentIndex = index;
  }

  isAnswered(questionId: string): boolean {
    return this.answers.has(questionId);
  }

  openSubmitDialog(): void {
    this.showSubmitDialog = true;
  }

  closeSubmitDialog(): void {
    this.showSubmitDialog = false;
  }

  submitExam(): void {
    this.isSubmitting = true;
    this.stopTimer();

    setTimeout(() => {
      this.totalQuestions = this.questions.length;
      this.correctAnswers = Math.floor(Math.random() * this.totalQuestions);
      this.score = this.correctAnswers;
      this.percentage = Math.round((this.correctAnswers / this.totalQuestions) * 100);
      this.state = 'result';
      this.isSubmitting = false;
      this.showSubmitDialog = false;
      this.snackBar.open('Exam submitted successfully', 'Close', { duration: 3000 });
    }, 1500);
  }

  goBackToExams(): void {
    this.router.navigate(['/mcq/available']);
  }

  getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
