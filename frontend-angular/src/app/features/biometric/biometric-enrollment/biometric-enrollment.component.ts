import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, Student } from '../../../core/models';

/**
 * Biometric enrolment page — admin picks a student, maps a card UID
 * (optional) and/or uploads a photo. Photo is compressed to ~30 KB on
 * the client before upload; a placeholder embedding is computed here
 * as a deterministic hash of the image bytes so the whole flow is
 * testable today, with real face-api.js embeddings dropping in later.
 */
@Component({
  selector: 'app-biometric-enrollment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './biometric-enrollment.component.html',
  styleUrl: './biometric-enrollment.component.scss',
})
export class BiometricEnrollmentComponent implements OnInit {

  classes: SchoolClass[] = [];
  students: Student[] = [];
  selectedClassId = '';
  selectedSectionId = '';
  selectedStudentId = '';
  cardUid = '';

  photoPreview: string | null = null;
  photoBase64: string | null = null;
  faceEmbedding: number[] | null = null;

  isLoadingStudents = false;
  isSaving = false;

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe({
      next: (res) => { this.classes = (res.data as SchoolClass[]) || []; },
    });
  }

  get sections(): any[] {
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    return (cls?.sections as any[]) || [];
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.selectedStudentId = '';
    this.students = [];
  }

  loadStudents(): void {
    if (!this.selectedClassId) { this.students = []; return; }
    this.isLoadingStudents = true;
    this.api.getStudents(0, 500, {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId || undefined,
    }).subscribe({
      next: (res) => {
        this.students = ((res?.data as any)?.content as Student[]) || [];
        this.isLoadingStudents = false;
      },
      error: () => { this.isLoadingStudents = false; this.students = []; },
    });
  }

  onStudentChange(): void {
    // Reset photo state — a new student needs a new photo.
    this.photoPreview = null;
    this.photoBase64 = null;
    this.faceEmbedding = null;
    this.cardUid = '';
    if (!this.selectedStudentId) return;
    // Pre-fill from existing data.
    const student = this.students.find(s => s.studentId === this.selectedStudentId);
    if (student && (student as any).cardUid) this.cardUid = (student as any).cardUid;
    this.api.getStudentFace(this.selectedStudentId).subscribe({
      next: (res) => {
        const bio = res?.data;
        if (bio?.photoBase64) {
          this.photoBase64 = bio.photoBase64;
          this.photoPreview = 'data:image/jpeg;base64,' + bio.photoBase64;
          this.faceEmbedding = bio.faceEmbedding || null;
        }
      },
    });
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file.', 'Close', { duration: 3000 });
      return;
    }
    this.processImageFile(file);
    if (input) input.value = '';
  }

  private processImageFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize + compress to ~256px longest side, JPEG quality 0.75.
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        this.photoPreview = dataUrl;
        this.photoBase64 = dataUrl.split(',')[1];
        this.faceEmbedding = this.computeStubEmbedding(ctx.getImageData(0, 0, w, h));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  /** Deterministic placeholder embedding — averages pixel channels
   *  across a 4×4 grid to make a 128-length vector. Same input photo
   *  yields the same vector, which is enough to test the round-trip
   *  today. Swap for face-api.js embeddings once the model bundle is
   *  wired into assets. */
  private computeStubEmbedding(imgData: ImageData): number[] {
    const { data, width, height } = imgData;
    const gridSize = 8;   // 8x8 grid × 2 (mean+var) = 128
    const cellW = Math.floor(width / gridSize);
    const cellH = Math.floor(height / gridSize);
    const means: number[] = new Array(gridSize * gridSize).fill(0);
    const counts: number[] = new Array(gridSize * gridSize).fill(0);
    for (let y = 0; y < height; y++) {
      const gy = Math.min(gridSize - 1, Math.floor(y / cellH));
      for (let x = 0; x < width; x++) {
        const gx = Math.min(gridSize - 1, Math.floor(x / cellW));
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const cell = gy * gridSize + gx;
        means[cell] += lum;
        counts[cell]++;
      }
    }
    for (let i = 0; i < means.length; i++) means[i] = counts[i] ? means[i] / counts[i] / 255 : 0;
    // Second half of the vector = neighbouring differences (adds some
    // structural information beyond means).
    const diffs: number[] = [];
    for (let i = 0; i < means.length; i++) {
      const rightIdx = i % gridSize < gridSize - 1 ? i + 1 : i - 1;
      diffs.push(means[i] - means[rightIdx]);
    }
    return [...means, ...diffs];
  }

  clearPhoto(): void {
    this.photoPreview = null;
    this.photoBase64 = null;
    this.faceEmbedding = null;
  }

  saveCard(): void {
    if (!this.selectedStudentId) return;
    this.isSaving = true;
    this.api.setStudentCardUid(this.selectedStudentId, this.cardUid?.trim() || '').subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Card mapping saved', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Save failed', 'Close', { duration: 3000 });
      },
    });
  }

  saveFace(): void {
    if (!this.selectedStudentId || !this.photoBase64 || !this.faceEmbedding) return;
    this.isSaving = true;
    this.api.enrollStudentFace(this.selectedStudentId, this.photoBase64, this.faceEmbedding).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Face enrolled', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Save failed', 'Close', { duration: 3000 });
      },
    });
  }

  studentLabel(s: Student): string {
    const name = [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
    return `${name || s.admissionNumber} · Roll ${s.rollNumber || '—'}`;
  }
}
