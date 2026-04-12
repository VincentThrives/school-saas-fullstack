import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = '/api/v1';

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
    return this.currentRole !== null && roles.includes(this.currentRole);
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
