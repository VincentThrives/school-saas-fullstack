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
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ApiService } from '../../../core/services/api.service';
import { FaceRecognitionService } from '../../../core/services/face-recognition.service';
import { SchoolClass, Student } from '../../../core/models';

interface EnrollmentRow {
  studentId: string;
  name: string;
  rollNumber: string | null;
  cardUid: string | null;
  hasFace: boolean;
}

/**
 * Biometric enrolment — admin picks a class + section, sees a table of
 * students sorted alphabetically, and enrolls each one via a per-row
 * Enrol button that opens a popup with both card mapping and face
 * upload / camera capture in a single dialog.
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
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './biometric-enrollment.component.html',
  styleUrl: './biometric-enrollment.component.scss',
})
export class BiometricEnrollmentComponent implements OnInit {

  classes: SchoolClass[] = [];
  selectedClassId = '';
  selectedSectionId = '';

  rows: EnrollmentRow[] = [];
  searchQuery = '';
  isLoadingStudents = false;
  private faceEnrolledIds = new Set<string>();

  // ── Enrol popup state ────────────────────────────────────
  dialogOpen = false;
  dialogRow: EnrollmentRow | null = null;
  dialogCardUid = '';
  /** The best photo of the batch — shown as the enrolled thumbnail. */
  dialogPhotoPreview: string | null = null;
  dialogPhotoBase64: string | null = null;
  /** Number of shots the operator captures per enrolment. Three is the
   *  sweet spot: enough angle/lighting variance to boost recall, few
   *  enough to keep enrolment fast. */
  readonly SHOT_TARGET = 3;
  /** Quality thresholds — reject a shot that fails these so bad frames
   *  don't poison the student's embedding set forever. */
  readonly MIN_DETECT_SCORE = 0.7;
  readonly MIN_FACE_AREA_RATIO = 0.05;    // face must fill ≥5% of frame
  /** Captured shots — one thumbnail + one embedding each. */
  dialogShots: { preview: string; base64: string; embedding: number[] }[] = [];
  captureError: string | null = null;
  isCapturing = false;
  isSaving = false;

  // Camera
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;
  cameraOpen = false;
  cameraError: string | null = null;
  private stream: MediaStream | null = null;

  isModelLoading = false;

  constructor(private api: ApiService, private snackBar: MatSnackBar,
              private faceRecognition: FaceRecognitionService) {}

  ngOnInit(): void {
    this.api.getClasses().subscribe({
      next: (res) => { this.classes = (res.data as SchoolClass[]) || []; },
    });
    // Warm up the face-detection model files so the admin doesn't have
    // to wait when they open their first enrol dialog.
    this.isModelLoading = true;
    this.faceRecognition.initialize()
        .catch(err => console.warn('Face-api model load failed', err))
        .finally(() => { this.isModelLoading = false; });
  }

  get sections(): any[] {
    const cls = this.classes.find(c => c.classId === this.selectedClassId);
    return (cls?.sections as any[]) || [];
  }

  onClassChange(): void {
    this.selectedSectionId = '';
    this.rows = [];
  }

  loadStudents(): void {
    if (!this.selectedClassId) { this.rows = []; return; }
    this.isLoadingStudents = true;
    // Fetch both the students AND the "who has face enrolled" set in
    // parallel; combine them into the table rows.
    this.api.getStudents(0, 500, {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId || undefined,
    }).subscribe({
      next: (res) => {
        const students = ((res?.data as any)?.content as Student[]) || [];
        this.api.getFaceEnrolledStudentIds().subscribe({
          next: (idsRes) => {
            this.faceEnrolledIds = new Set(idsRes?.data || []);
            this.rebuildRows(students);
            this.isLoadingStudents = false;
          },
          error: () => {
            this.faceEnrolledIds = new Set();
            this.rebuildRows(students);
            this.isLoadingStudents = false;
          },
        });
      },
      error: () => {
        this.isLoadingStudents = false;
        this.rows = [];
      },
    });
  }

  private rebuildRows(students: Student[]): void {
    this.rows = students.map(s => ({
      studentId: s.studentId,
      name: this.displayName(s),
      rollNumber: s.rollNumber || null,
      cardUid: (s as any).cardUid || null,
      hasFace: this.faceEnrolledIds.has(s.studentId),
    })).sort((a, b) => a.name.localeCompare(b.name,
        undefined, { sensitivity: 'base' }));
  }

  private displayName(s: Student): string {
    const name = [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
    return name || s.admissionNumber || s.studentId;
  }

  get filteredRows(): EnrollmentRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(r =>
        r.name.toLowerCase().includes(q)
        || (r.rollNumber || '').toLowerCase().includes(q));
  }

  get enrolledCount(): number { return this.rows.filter(r => r.hasFace).length; }
  get cardMappedCount(): number { return this.rows.filter(r => !!r.cardUid).length; }

  // ── Dialog open / close ──────────────────────────────────

  openEnrollDialog(row: EnrollmentRow): void {
    this.dialogRow = row;
    this.dialogOpen = true;
    this.dialogCardUid = row.cardUid || '';
    this.dialogPhotoPreview = null;
    this.dialogPhotoBase64 = null;
    this.dialogShots = [];
    this.captureError = null;

    // Pre-fill existing face thumbnail so admin sees what's already
    // saved. Shots list stays empty — re-enrolment always captures
    // fresh so we don't mix old low-quality embeddings with new ones.
    if (row.hasFace) {
      this.api.getStudentFace(row.studentId).subscribe({
        next: (res) => {
          const bio = res?.data;
          if (bio?.photoBase64) {
            this.dialogPhotoBase64 = bio.photoBase64;
            this.dialogPhotoPreview = 'data:image/jpeg;base64,' + bio.photoBase64;
          }
        },
      });
    }
  }

  closeDialog(): void {
    this.closeCamera();
    this.dialogOpen = false;
    this.dialogRow = null;
  }

  // ── Card save ────────────────────────────────────────────

  saveCard(): void {
    if (!this.dialogRow) return;
    const uid = this.dialogCardUid?.trim() || '';
    this.isSaving = true;
    this.api.setStudentCardUid(this.dialogRow.studentId, uid).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Card mapping saved', 'Close', { duration: 2200 });
        if (this.dialogRow) this.dialogRow.cardUid = uid || null;
        const row = this.rows.find(r => r.studentId === this.dialogRow?.studentId);
        if (row) row.cardUid = uid || null;
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Save failed', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Photo file upload ────────────────────────────────────

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
    this.processImageFileToShot(file);
    if (input) input.value = '';
  }

  // ── Webcam capture ───────────────────────────────────────

  async openCamera(): Promise<void> {
    this.cameraError = null;
    this.cameraOpen = true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      setTimeout(() => {
        if (this.videoEl && this.stream) {
          this.videoEl.nativeElement.srcObject = this.stream;
          this.videoEl.nativeElement.play().catch(() => { /* ok */ });
        }
      });
    } catch (err: any) {
      this.cameraError = err?.message
          || 'Could not access the camera. Check the browser has camera permission.';
    }
  }

  closeCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.cameraOpen = false;
    this.cameraError = null;
  }

  capturePhoto(): void {
    const video = this.videoEl?.nativeElement;
    if (!video || !this.stream) return;
    this.addShot(video, video.videoWidth || 480, video.videoHeight || 480, true);
  }

  removeShot(idx: number): void {
    this.dialogShots.splice(idx, 1);
    if (this.dialogShots.length === 0) {
      this.dialogPhotoPreview = null;
      this.dialogPhotoBase64 = null;
    } else {
      // Keep the top-of-list shot as the display thumbnail.
      this.dialogPhotoPreview = this.dialogShots[0].preview;
      this.dialogPhotoBase64 = this.dialogShots[0].base64;
    }
  }

  clearShots(): void {
    this.dialogShots = [];
    this.dialogPhotoPreview = null;
    this.dialogPhotoBase64 = null;
    this.captureError = null;
  }

  /** True once the operator has captured SHOT_TARGET clear shots and
   *  Save Face should be enabled. */
  get canSaveShots(): boolean {
    return this.dialogShots.length >= this.SHOT_TARGET;
  }

  private async addShot(source: CanvasImageSource, vw: number, vh: number, mirror: boolean): Promise<void> {
    if (this.isCapturing) return;
    if (this.dialogShots.length >= this.SHOT_TARGET) return;
    this.isCapturing = true;
    this.captureError = null;
    try {
      // Store a small JPEG for display; run detection on a bigger crop
      // so TinyFaceDetector has enough pixels.
      const max = 256;
      const scale = Math.min(1, max / Math.max(vw, vh));
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(source, 0, 0, w, h);
      if (mirror) ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

      const detectMax = 512;
      const dScale = Math.min(1, detectMax / Math.max(vw, vh));
      const dw = Math.round(vw * dScale);
      const dh = Math.round(vh * dScale);
      const detectCanvas = document.createElement('canvas');
      detectCanvas.width = dw;
      detectCanvas.height = dh;
      const dctx = detectCanvas.getContext('2d')!;
      if (mirror) { dctx.translate(dw, 0); dctx.scale(-1, 1); }
      dctx.drawImage(source, 0, 0, dw, dh);
      if (mirror) dctx.setTransform(1, 0, 0, 1, 0, 0);

      if (!this.faceRecognition.isReady()) {
        const snack = this.snackBar.open('Loading face model — this only happens once…', '', { duration: 0 });
        try {
          await this.faceRecognition.initialize();
        } catch (err) {
          snack.dismiss();
          this.captureError = 'Face model failed to load. Refresh the page and try again.';
          return;
        }
        snack.dismiss();
      }

      const detection = await this.faceRecognition.detect(detectCanvas);
      if (!detection) {
        this.captureError = 'No face detected. Move closer and face the camera.';
        return;
      }
      if (detection.score < this.MIN_DETECT_SCORE) {
        this.captureError = `Face not clear enough (score ${detection.score.toFixed(2)}). Improve lighting and try again.`;
        return;
      }
      if (detection.areaRatio < this.MIN_FACE_AREA_RATIO) {
        this.captureError = 'Face is too small in the frame. Move closer to the camera.';
        return;
      }

      const shot = { preview: dataUrl, base64: dataUrl.split(',')[1], embedding: detection.embedding };
      this.dialogShots.push(shot);
      // The first captured shot becomes the display thumbnail.
      if (this.dialogShots.length === 1) {
        this.dialogPhotoPreview = shot.preview;
        this.dialogPhotoBase64 = shot.base64;
      }
    } finally {
      this.isCapturing = false;
    }
  }

  /** File upload path — reuses the shot capture flow so uploaded
   *  photos go through the same quality gate as webcam captures. */
  private async processImageFileToShot(file: File): Promise<void> {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => this.addShot(img, img.width, img.height, false);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  saveFace(): void {
    if (!this.dialogRow || !this.canSaveShots) return;
    this.isSaving = true;
    const embeddings = this.dialogShots.map(s => s.embedding);
    const displayPhoto = this.dialogShots[0].base64;
    this.api.enrollStudentFace(this.dialogRow.studentId, displayPhoto, embeddings).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Face enrolled', 'Close', { duration: 2200 });
        // Update row + set membership so the badge appears without
        // a full reload.
        if (this.dialogRow) this.dialogRow.hasFace = true;
        const row = this.rows.find(r => r.studentId === this.dialogRow?.studentId);
        if (row) row.hasFace = true;
        this.faceEnrolledIds.add(this.dialogRow!.studentId);
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Save failed', 'Close', { duration: 3000 });
      },
    });
  }

  clearFaceEnrolment(): void {
    if (!this.dialogRow) return;
    const ok = confirm(`Remove face enrolment for ${this.dialogRow.name}?`);
    if (!ok) return;
    this.isSaving = true;
    this.api.clearStudentFace(this.dialogRow.studentId).subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('Face enrolment removed', 'Close', { duration: 2200 });
        if (this.dialogRow) this.dialogRow.hasFace = false;
        const row = this.rows.find(r => r.studentId === this.dialogRow?.studentId);
        if (row) row.hasFace = false;
        this.faceEnrolledIds.delete(this.dialogRow!.studentId);
        this.clearShots();
        this.dialogPhotoPreview = null;
        this.dialogPhotoBase64 = null;
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error?.message || 'Delete failed', 'Close', { duration: 3000 });
      },
    });
  }

  initial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }
}
