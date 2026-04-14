import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';

export interface SubjectItem {
  subjectId: string;
  name: string;
  code?: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class SubjectService {
  private readonly API = '/api/v1';
  private subjects$ = new BehaviorSubject<SubjectItem[]>([]);
  private loaded = false;

  // Default subjects as fallback
  private defaults: SubjectItem[] = [
    { subjectId: 'kannada', name: 'Kannada' },
    { subjectId: 'english', name: 'English' },
    { subjectId: 'hindi', name: 'Hindi' },
    { subjectId: 'math', name: 'Mathematics' },
    { subjectId: 'science', name: 'Science' },
    { subjectId: 'social', name: 'Social Science' },
    { subjectId: 'history', name: 'History' },
    { subjectId: 'geography', name: 'Geography' },
    { subjectId: 'physics', name: 'Physics' },
    { subjectId: 'chemistry', name: 'Chemistry' },
    { subjectId: 'biology', name: 'Biology' },
    { subjectId: 'computer', name: 'Computer Science' },
    { subjectId: 'sanskrit', name: 'Sanskrit' },
    { subjectId: 'evs', name: 'EVS' },
    { subjectId: 'pe', name: 'Physical Education' },
    { subjectId: 'art', name: 'Art & Craft' },
    { subjectId: 'music', name: 'Music' },
    { subjectId: 'moral', name: 'Moral Science' },
  ];

  constructor(private http: HttpClient) {}

  loadSubjects(): void {
    if (this.loaded) return;
    this.http.get<any>(`${this.API}/subjects`).subscribe({
      next: (res) => {
        const apiSubjects = res.data || [];
        if (apiSubjects.length > 0) {
          this.subjects$.next(apiSubjects.map((s: any) => ({
            subjectId: s.subjectId || s.id,
            name: s.name,
            code: s.code,
            type: s.type,
          })));
        } else {
          this.subjects$.next(this.defaults);
        }
        this.loaded = true;
      },
      error: () => {
        this.subjects$.next(this.defaults);
        this.loaded = true;
      },
    });
  }

  getSubjects(): Observable<SubjectItem[]> {
    if (!this.loaded) this.loadSubjects();
    return this.subjects$.asObservable();
  }

  getSubjectsList(): SubjectItem[] {
    if (!this.loaded) this.loadSubjects();
    return this.subjects$.value.length > 0 ? this.subjects$.value : this.defaults;
  }

  getSubjectName(subjectId: string): string {
    const subjects = this.subjects$.value.length > 0 ? this.subjects$.value : this.defaults;
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
        return apiSubjects.map((s: any) => ({
          subjectId: s.subjectId || s.id,
          name: s.name,
          code: s.code,
          type: s.type,
        }));
      })
    );
  }

  getSubjectsByIds(ids: string[]): Observable<SubjectItem[]> {
    if (!ids || ids.length === 0) return new Observable(sub => { sub.next([]); sub.complete(); });
    let params = new HttpParams();
    ids.forEach(id => { params = params.append('ids', id); });
    return this.http.get<any>(`${this.API}/subjects`, { params }).pipe(
      map((res: any) => {
        const apiSubjects = res.data || [];
        return apiSubjects.map((s: any) => ({
          subjectId: s.subjectId || s.id,
          name: s.name,
          code: s.code,
          type: s.type,
        }));
      })
    );
  }

  refreshSubjects(): void {
    this.loaded = false;
    this.loadSubjects();
  }

  createSubject(subject: { name: string; code?: string; type?: string }): Observable<any> {
    return this.http.post<any>(`${this.API}/subjects`, subject).pipe(
      tap(() => this.refreshSubjects())
    );
  }

  deleteSubject(subjectId: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/subjects/${subjectId}`).pipe(
      tap(() => this.refreshSubjects())
    );
  }
}
