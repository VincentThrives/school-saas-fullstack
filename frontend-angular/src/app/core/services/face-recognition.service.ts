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
   *  aren't loaded yet. */
  async computeEmbedding(
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  ): Promise<number[] | null> {
    if (!this.ready) return null;
    // Tiny detector is fast enough for realtime kiosk use. inputSize
    // 320 is a decent quality/speed trade-off for a laptop webcam.
    const detected = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (!detected || !detected.descriptor) return null;
    return Array.from(detected.descriptor);
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
