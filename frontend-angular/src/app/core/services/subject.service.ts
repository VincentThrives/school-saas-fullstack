import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AssessmentMode = 'EXAM' | 'INTERNAL';
export type InternalSchedule = 'PER_TERM' | 'PER_YEAR';
export type PassRule = 'PER_COMPONENT' | 'COMBINED';

/**
 * One slice of a subject — Theory, Practical, Internal Assessment,
 * Project, etc. Each component carries its own marks scheme,
 * attendance toggle and assessment mode.
 */
export interface SubjectComponent {
  /** Stable machine key. Lowercase, e.g. "theory", "practical". */
  key: string;
  /** Human-readable label shown on the report card. */
  label: string;
  /**
   * Optional from this version on — max/pass marks now live on the Exam
   * doc, not the subject. The fields are kept here so the deserializer
   * accepts legacy data without complaint, but the Subject form no longer
   * collects them and the report card aggregator pulls effective max/pass
   * from the exam, not from this field.
   */
  maxMarks?: number | null;
  passMarks?: number | null;
  /** Off for IA / Project components — they're not class-based. */
  trackAttendance: boolean;
  assessmentMode: AssessmentMode;
  /** Only meaningful when assessmentMode = INTERNAL. Defaults to PER_TERM. */
  internalSchedule?: InternalSchedule;
}

export interface SubjectAssignment {
  classId: string;
  sectionIds: string[];
}

/**
 * Teaching-side slice of a subject — orthogonal to {@link SubjectComponent}.
 * Lets one Subject row ("Science") have sub-parts (Physics / Chemistry /
 * Biology) that each get their own teacher and timetable period without
 * fragmenting the exam, marks scheme or report card.
 */
export interface SubjectSubPart {
  key: string;
  label: string;
  code?: string;
}

export interface SubjectItem {
  subjectId: string;
  name: string;
  code?: string;
  /** @deprecated Old flat type field. New shape uses {@link components} below. */
  type?: string;
  /** @deprecated Replaced by {@link assignments}. Kept to read legacy docs. */
  classId?: string;
  academicYearId?: string;
  passRule?: PassRule;
  components?: SubjectComponent[];
  /** Optional teaching-side breakdown — empty or absent for most subjects. */
  subParts?: SubjectSubPart[];
  /** The (class, sections) pairs this subject is taught in. */
  assignments?: SubjectAssignment[];
}

/**
 * Payload shape for POST /subjects + PUT /subjects/{id}.
 * Mirrors the backend Subject document.
 *
 * <p>{@code applyToSectionIds} drives the auto-attach: when the
 * backend saves the subject, it pushes the new subject's id into
 * the listed sections' {@code subjectIds} arrays. Omitting the
 * field (or sending an empty array) attaches the subject to ALL
 * sections of the chosen class.
 */
export interface CreateOrUpdateSubject {
  name: string;
  code?: string;
  academicYearId: string;
  passRule?: PassRule;
  components: SubjectComponent[];
  /** Optional teaching-side breakdown — sent only when the form's
   *  "Subject has sub-parts?" toggle is on. Empty array otherwise so the
   *  backend clears any previously-saved list on edit. */
  subParts?: SubjectSubPart[];
  /** Pairs of (classId, sectionIds) the subject is taught in. ONE submission
   *  creates ONE Subject document attached to all the listed classes. */
  assignments: SubjectAssignment[];
}

@Injectable({ providedIn: 'root' })
export class SubjectService {
  // Resolved at build time — see `src/environments/`.
  private readonly API = environment.apiUrl;
  private subjects$ = new BehaviorSubject<SubjectItem[]>([]);
  private loaded = false;

  constructor(private http: HttpClient) {}

  loadSubjects(): void {
    if (this.loaded) return;
    this.http.get<any>(`${this.API}/subjects`).subscribe({
      next: (res) => {
        const apiSubjects = res.data || [];
        this.subjects$.next(apiSubjects.map((s: any) => this.toSubjectItem(s)));
        this.loaded = true;
      },
      error: () => {
        // No fallback to a baked-in subject list — let consumers show an
        // empty state instead of misleading defaults.
        this.subjects$.next([]);
        this.loaded = true;
      },
    });
  }

  /**
   * Normalise an API subject document into a SubjectItem. Handles both
   * the new component-shaped subjects and any legacy single-type rows
   * that still sit in old tenants' databases — those get their {@code
   * type} preserved on the deprecated field but no {@code components}
   * list, so downstream code can fall back to old behaviour.
   */
  private toSubjectItem(s: any): SubjectItem {
    // Server-side migration should already have moved classId into a
    // single-entry assignments array, but fall through here too so
    // pre-migration docs (if any leaked through) still resolve.
    let assignments: SubjectAssignment[] | undefined;
    if (Array.isArray(s.assignments) && s.assignments.length > 0) {
      assignments = s.assignments.map((a: any) => ({
        classId: a.classId,
        sectionIds: a.sectionIds || [],
      }));
    } else if (s.classId) {
      assignments = [{ classId: s.classId, sectionIds: [] }];
    }
    return {
      subjectId: s.subjectId || s.id,
      name: s.name,
      code: s.code,
      type: s.type,
      classId: s.classId,
      academicYearId: s.academicYearId,
      passRule: s.passRule,
      components: Array.isArray(s.components) ? s.components : undefined,
      subParts: Array.isArray(s.subParts) ? s.subParts.map((sp: any) => ({
        key: sp.key,
        label: sp.label,
        code: sp.code,
      })) : undefined,
      assignments,
    };
  }

  getSubjects(): Observable<SubjectItem[]> {
    if (!this.loaded) this.loadSubjects();
    return this.subjects$.asObservable();
  }

  getSubjectsList(): SubjectItem[] {
    if (!this.loaded) this.loadSubjects();
    return this.subjects$.value;
  }

  getSubjectName(subjectId: string): string {
    const subjects = this.subjects$.value;
    const found = subjects.find(s => s.subjectId === subjectId || s.subjectId === subjectId?.toLowerCase());
    if (found) return found.name;
    // Fallback lookup for old IDs
    const fallback: Record<string, string> = {
      maths: 'Mathematics', 'math-101': 'Mathematics',
    };
    return fallback[subjectId] || subjectId || '-';
  }

  getSubjectsByClassAndYear(classId: string, academicYearId: string): Observable<SubjectItem[]> {
    const params = new HttpParams()
      .set('classId', classId)
      .set('academicYearId', academicYearId);
    return this.http.get<any>(`${this.API}/subjects`, { params }).pipe(
      map((res: any) => {
        const apiSubjects = res.data || [];
        return apiSubjects.map((s: any) => this.toSubjectItem(s));
      })
    );
  }

  getSubjectsByIds(ids: string[]): Observable<SubjectItem[]> {
    if (!ids || ids.length === 0) return new Observable(sub => { sub.next([]); sub.complete(); });
    let params = new HttpParams();
    ids.forEach(id => { params = params.append('ids', id); });
    return this.http.get<any>(`${this.API}/subjects`, { params }).pipe(
      map((res: any) => this.resolveByIds(ids, res?.data || [])),
      // For ids that the API didn't return, we surface a SubjectItem with
      // raw id as the label (rather than dropping it). Keeps dropdowns
      // populated even when a referenced subject was deleted upstream.
    );
  }

  /** Build one SubjectItem per requested id, in the input order. Looks up
   *  names in the API response first; missing ids fall back to the raw id
   *  as the display label. */
  private resolveByIds(ids: string[], apiData: any[]): SubjectItem[] {
    const byId = new Map<string, SubjectItem>();
    apiData.forEach(s => {
      const id = s.subjectId || s.id;
      byId.set(id, this.toSubjectItem(s));
    });
    return ids.map(id => byId.get(id) || ({ subjectId: id, name: id } as SubjectItem));
  }

  refreshSubjects(): void {
    this.loaded = false;
    this.loadSubjects();
  }

  createSubject(subject: CreateOrUpdateSubject): Observable<any> {
    return this.http.post<any>(`${this.API}/subjects`, subject).pipe(
      tap(() => this.refreshSubjects())
    );
  }

  updateSubject(subjectId: string, subject: CreateOrUpdateSubject): Observable<any> {
    return this.http.put<any>(`${this.API}/subjects/${subjectId}`, subject).pipe(
      tap(() => this.refreshSubjects())
    );
  }

  deleteSubject(subjectId: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/subjects/${subjectId}`).pipe(
      tap(() => this.refreshSubjects())
    );
  }
}
