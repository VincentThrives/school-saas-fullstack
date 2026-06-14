import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

/** One row in the grading scale — minimum percentage (inclusive) for
 *  the given letter. Bands sort high→low so the resolver picks the
 *  first one the percentage clears. */
export interface GradingBand {
  grade: string;
  minPercent: number;
}

/**
 * Centralised grading helper for everything that turns marks into a
 * letter grade — currently the marks-entry table, the exam results
 * page, and (by extension) report cards.
 *
 * <p>Why a service:</p>
 * <ul>
 *   <li>Both pages USED to keep their own hardcoded copy of the band
 *       table (A+ 90+, A 80+, …). They drifted out of sync the moment
 *       any rule changed, which is exactly what shipped the "F / Pass"
 *       inconsistency parents saw on the results screen.</li>
 *   <li>The school's editable grading scale on Settings → Academic is
 *       only useful if downstream consumers actually read it. This
 *       service is the bridge: it pulls the saved scale once, caches
 *       it, and replays the same answer to every caller.</li>
 *   <li>Rounding is a separate concern that always tripped people up
 *       (89.5 → A or B?). Centralising it here means "89.5 rounds to
 *       90, 89.4 stays 89" is true for every screen at once.</li>
 * </ul>
 *
 * <p>Fall-back rule: if the school hasn't configured a scale yet, or
 * the API call fails, we use the default Indian-school scale
 * (A+ 90, A 80, B+ 70, B 60, C 50, D 35) so existing demos look the
 * same as before this service was introduced.</p>
 */
@Injectable({ providedIn: 'root' })
export class GradingService {

  /** Sensible default — same letters the marks-entry page used to
   *  hardcode before this service existed. F is anchored to the exam's
   *  pass threshold in {@link #gradeFor}, not to a percentage band. */
  readonly defaultScale: GradingBand[] = [
    { grade: 'A+', minPercent: 90 },
    { grade: 'A',  minPercent: 80 },
    { grade: 'B+', minPercent: 70 },
    { grade: 'B',  minPercent: 60 },
    { grade: 'C',  minPercent: 50 },
    { grade: 'D',  minPercent: 35 },
  ];

  /** Loaded scale (high→low minPercent). Defaults until the
   *  /settings call resolves. Subjects-style so any late subscribers
   *  (e.g. a teacher opening marks before settings finished loading)
   *  still get the right value when it arrives. */
  private readonly scale$ = new BehaviorSubject<GradingBand[]>(this.defaultScale);

  /** Single in-flight fetch; subsequent callers reuse the same response. */
  private fetch$: Observable<GradingBand[]> | null = null;

  constructor(private api: ApiService) {}

  /** Current snapshot of the active scale. Sorted high→low minPercent so
   *  {@link #gradeFor} can return the first match. */
  get scale(): GradingBand[] {
    return this.scale$.getValue();
  }

  /** Stream of the scale — components can subscribe in ngOnInit and
   *  re-render when settings load. Replays the most recent value to
   *  late subscribers. */
  scaleChanges(): Observable<GradingBand[]> {
    return this.scale$.asObservable();
  }

  /** Pull the school's grading scale from /settings ONCE per session.
   *  Falls back to the default scale on any failure (404 for a fresh
   *  tenant, network blip, etc.) so the pages keep grading even if
   *  the settings doc was never saved. Components should call this
   *  on init — repeated calls reuse the cached observable. */
  load(): Observable<GradingBand[]> {
    if (this.fetch$) return this.fetch$;
    this.fetch$ = this.api.getSettings().pipe(
      tap((res: any) => {
        const saved = res?.data?.gradingScale;
        if (Array.isArray(saved) && saved.length > 0) {
          // Coerce + sort. We trust the editor's validation upstream
          // but defend against odd shapes (string percentages, nulls).
          const cleaned: GradingBand[] = saved
            .filter((g: any) => g && typeof g.grade === 'string' && g.grade.trim() !== ''
                              && g.minPercent !== null && g.minPercent !== undefined)
            .map((g: any) => ({
              grade: String(g.grade).trim(),
              minPercent: Number(g.minPercent),
            }))
            // Drop any explicit F entry — F is computed against the
            // exam's passingMarks, not a fixed percentage. Including
            // it here would mask 17/50 as F instead of D.
            .filter(g => g.grade.toUpperCase() !== 'F')
            // High→low for first-match resolution.
            .sort((a, b) => b.minPercent - a.minPercent);
          if (cleaned.length > 0) this.scale$.next(cleaned);
        }
      }),
      catchError(() => of(this.defaultScale)),
      shareReplay(1),
    ) as unknown as Observable<GradingBand[]>;
    return this.fetch$;
  }

  /** Percentage rounded to nearest integer using standard half-up.
   *  89.5 → 90, 89.6 → 90, 89.4 → 89. Used as the input to the band
   *  lookup so admins can describe their bands in whole-number cuts
   *  (which they always do — nobody writes a band at 89.5%). */
  roundPercent(marks: number, maxMarks: number): number {
    if (!maxMarks || maxMarks <= 0) return 0;
    return Math.round((marks / maxMarks) * 100);
  }

  /**
   * Letter grade for a marks value.
   *
   * <p>Rules in order:</p>
   * <ol>
   *   <li>{@code marks < passingMarks} → "F" (failing). Anchored to the
   *       exam's own threshold so 17/50 with passingMarks=17 isn't
   *       graded F by a 35 %-of-max rule.</li>
   *   <li>Otherwise: round the percentage (89.5 → 90, 89.4 → 89), then
   *       return the first band whose {@code minPercent} the rounded
   *       percentage clears.</li>
   *   <li>Falls through to the lowest band when no band matches — the
   *       school can shape this however they want (e.g. add a "D-" at
   *       0 %) and we won't hardcode anything below it.</li>
   * </ol>
   */
  gradeFor(marks: number | null | undefined, maxMarks: number, passingMarks: number): string {
    if (marks === null || marks === undefined) return '-';
    if (passingMarks != null && marks < passingMarks) return 'F';
    const pct = this.roundPercent(marks, maxMarks);
    for (const band of this.scale) {
      if (pct >= band.minPercent) return band.grade;
    }
    // No band matched — fall back to the lowest band's letter so the
    // result is at least non-empty.
    return this.scale.length > 0
      ? this.scale[this.scale.length - 1].grade
      : 'D';
  }
}
