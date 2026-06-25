import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, throwError, shareReplay, catchError, map, finalize } from 'rxjs';
import { Router } from '@angular/router';
import {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  SuperAdminLoginRequest,
  ResolveTenantRequest,
  TenantPublicInfo,
  User,
  UserRole,
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Resolved at build time — see `src/environments/`.
  private readonly API = environment.apiUrl;

  private accessToken$ = new BehaviorSubject<string | null>(
    localStorage.getItem('accessToken')
  );
  private refreshToken$ = new BehaviorSubject<string | null>(
    localStorage.getItem('refreshToken')
  );
  private currentUser$ = new BehaviorSubject<User | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  private role$ = new BehaviorSubject<UserRole | null>(
    (localStorage.getItem('role') as UserRole) || null
  );
  private featureFlags$ = new BehaviorSubject<Record<string, boolean>>(
    JSON.parse(localStorage.getItem('featureFlags') || '{}')
  );
  private schoolInfo$ = new BehaviorSubject<TenantPublicInfo | null>(
    JSON.parse(localStorage.getItem('schoolInfo') || 'null')
  );

  user = this.currentUser$.asObservable();
  token = this.accessToken$.asObservable();
  role = this.role$.asObservable();
  featureFlags = this.featureFlags$.asObservable();
  schoolInfo = this.schoolInfo$.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  get accessToken(): string | null {
    return this.accessToken$.value;
  }

  get refreshToken(): string | null {
    return this.refreshToken$.value;
  }

  /**
   * Single-flight refresh attempt. Multiple concurrent 401s would otherwise
   * each fire their own /auth/refresh call — we share one in-flight
   * Observable so the backend (and audit log) sees a single hit.
   */
  private refreshInFlight$: Observable<string> | null = null;

  /**
   * Exchange the stored refresh token for a fresh access token (and a new
   * rolling refresh token, so the 7-day window restarts every successful
   * refresh). Picks the super-admin endpoint when the current session is
   * a super-admin, the tenant endpoint otherwise — they have the same
   * shape but live on different paths.
   *
   * Returns the new access token. Errors when:
   *   • No refresh token stored locally → emits error, caller should log out.
   *   • Backend rejects the refresh token (expired / revoked) → same.
   */
  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    const token = this.refreshToken;
    if (!token) {
      return throwError(() => new Error('No refresh token stored.'));
    }
    const endpoint = this.isSuperAdmin ? '/super/auth/refresh' : '/auth/refresh';
    const headers = new HttpHeaders({ 'X-Refresh-Token': token });

    this.refreshInFlight$ = this.http
      .post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
        `${this.API}${endpoint}`,
        {},
        { headers },
      )
      .pipe(
        map((res) => {
          if (!res?.success || !res.data?.accessToken) {
            throw new Error('Refresh response missing tokens.');
          }
          // Persist new tokens. We keep the existing user/role/flags —
          // the refresh endpoint doesn't re-issue those, and they
          // shouldn't have changed mid-session.
          this.accessToken$.next(res.data.accessToken);
          this.refreshToken$.next(res.data.refreshToken);
          localStorage.setItem('accessToken', res.data.accessToken);
          localStorage.setItem('refreshToken', res.data.refreshToken);
          return res.data.accessToken;
        }),
        catchError((err) => {
          // Refresh itself failed — caller will redirect to /login.
          return throwError(() => err);
        }),
        finalize(() => { this.refreshInFlight$ = null; }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight$;
  }

  get currentRole(): UserRole | null {
    return this.role$.value;
  }

  get currentUser(): User | null {
    return this.currentUser$.value;
  }

  get currentFeatureFlags(): Record<string, boolean> {
    return this.featureFlags$.value;
  }

  get currentSchoolInfo(): TenantPublicInfo | null {
    return this.schoolInfo$.value;
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken$.value;
  }

  get isSuperAdmin(): boolean {
    return this.role$.value === UserRole.SUPER_ADMIN;
  }

  resolveTenant(
    req: ResolveTenantRequest
  ): Observable<ApiResponse<TenantPublicInfo>> {
    return this.http
      .post<ApiResponse<TenantPublicInfo>>(
        `${this.API}/auth/resolve-tenant`,
        req
      )
      .pipe(
        tap((res) => {
          if (res.success) {
            this.schoolInfo$.next(res.data);
            localStorage.setItem('schoolInfo', JSON.stringify(res.data));
          }
        })
      );
  }

  login(req: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.API}/auth/login`, req)
      .pipe(tap((res) => { if (res.success) this.setCredentials(res.data); }));
  }

  superAdminLogin(
    req: SuperAdminLoginRequest
  ): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.API}/super/auth/login`, req)
      .pipe(tap((res) => { if (res.success) this.setCredentials(res.data); }));
  }

  logout(): void {
    this.http.post(`${this.API}/auth/logout`, {}).subscribe({ error: () => {} });
    this.clearCredentials();
    this.router.navigate(['/login']);
  }

  isFeatureEnabled(key: string): boolean {
    return this.currentFeatureFlags[key] === true || this.isSuperAdmin;
  }

  hasRole(...roles: UserRole[]): boolean {
    if (this.currentRole === null) return false;
    if (roles.includes(this.currentRole)) return true;
    // SCHOOL_COORDINATOR is a replica of admin — mirrors the
    // backend's JwtAuthFilter dual-authority grant. Every UI check
    // of the form `hasRole(SCHOOL_ADMIN)` (Add buttons, edit
    // pencils, etc.) treats a coordinator as an admin. Pages that
    // must stay admin-only (Manage Users, Coordinator Access) are
    // blocked by the route guard's `adminOnly` flag, NOT this
    // method.
    return this.currentRole === UserRole.SCHOOL_COORDINATOR
        && roles.includes(UserRole.SCHOOL_ADMIN);
  }

  private setCredentials(auth: AuthResponse): void {
    this.accessToken$.next(auth.accessToken);
    this.refreshToken$.next(auth.refreshToken);
    this.currentUser$.next(auth.user);
    this.role$.next(auth.role);
    this.featureFlags$.next(auth.featureFlags);
    localStorage.setItem('accessToken', auth.accessToken);
    localStorage.setItem('refreshToken', auth.refreshToken);
    localStorage.setItem('user', JSON.stringify(auth.user));
    localStorage.setItem('role', auth.role);
    localStorage.setItem('featureFlags', JSON.stringify(auth.featureFlags));
  }

  clearCredentials(): void {
    this.accessToken$.next(null);
    this.refreshToken$.next(null);
    this.currentUser$.next(null);
    this.role$.next(null);
    this.featureFlags$.next({});
    this.schoolInfo$.next(null);
    localStorage.clear();
  }

  clearTenant(): void {
    this.schoolInfo$.next(null);
    localStorage.removeItem('schoolInfo');
  }
}
