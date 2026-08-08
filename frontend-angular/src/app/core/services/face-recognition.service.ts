import { Injectable } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';

/**
 * Wraps @vladmandic/face-api so the enrollment page and kiosk both
 * compute the SAME kind of embedding — a 128-D FaceNet descriptor of
 * the largest detected face in the frame.
 *
 * <p>Why this exists: the earlier "stub" embedding fingerprinted the
 * whole frame (background wall, lighting and all), which meant an empty
 * classroom occasionally cleared the similarity threshold against
 * enrolled students. Real face detection crops to the face first, so
 * only the face contributes to the embedding.</p>
 *
 * <p>Models load once and cache in the browser. All three files sit
 * under public/models/ (served at /models/) and total ~7 MB — kept
 * local so the kiosk works fully offline once loaded.</p>
 */
@Injectable({ providedIn: 'root' })
export class FaceRecognitionService {

  private readonly MODEL_URL = '/models';
  private ready = false;
  private loading: Promise<void> | null = null;

  /** Kicks off model loading. Safe to call many times — subsequent
   *  calls await the same in-flight promise. */
  initialize(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL),
      ]);
      this.ready = true;
    })();
    return this.loading;
  }

  isReady(): boolean { return this.ready; }

  /** Compute a 128-D FaceNet descriptor for the largest face in the
   *  given input. Returns null if no face was found or the models
   *  aren't loaded yet. Kept for backward-compatible call sites. */
  async computeEmbedding(
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  ): Promise<number[] | null> {
    const d = await this.detect(input);
    return d ? d.embedding : null;
  }

  /** Full detection result — embedding plus the metadata enrolment
   *  needs to gate quality (detection score, face-box area ratio). */
  async detect(
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  ): Promise<{ embedding: number[]; score: number; areaRatio: number } | null> {
    if (!this.ready) return null;
    // inputSize 416 gives noticeably better crops on webcam-quality
    // frames than 320 for a small perf hit (~40ms/detect).
    const detected = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.5,
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (!detected || !detected.descriptor) return null;
    const box = detected.detection.box;
    const iw = (input as any).videoWidth || (input as any).naturalWidth || (input as any).width;
    const ih = (input as any).videoHeight || (input as any).naturalHeight || (input as any).height;
    const totalArea = Math.max(1, iw * ih);
    const areaRatio = (box.width * box.height) / totalArea;
    return {
      embedding: Array.from(detected.descriptor),
      score: detected.detection.score,
      areaRatio,
    };
  }

  /** Cosine similarity — the metric the kiosk uses when comparing a
   *  live frame's embedding to enrolled student embeddings. FaceNet is
   *  typically compared with Euclidean distance, but cosine works fine
   *  for 128-D unit-ish vectors and matches the existing kiosk math. */
  cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      aa  += a[i] * a[i];
      bb  += b[i] * b[i];
    }
    if (aa === 0 || bb === 0) return 0;
    return dot / (Math.sqrt(aa) * Math.sqrt(bb));
  }
}
