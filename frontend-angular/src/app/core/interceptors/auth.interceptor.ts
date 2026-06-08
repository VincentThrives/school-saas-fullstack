import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Endpoints that must NEVER have an Authorization header attached and must
 * NEVER trigger an auto-refresh on 401 — they ARE the login / refresh
 * flow, so a refresh attempt on a failing /auth/refresh would loop forever.
 */
const PUBLIC_URLS = [
  '/api/v1/auth/login',
  '/api/v1/auth/resolve-tenant',
  '/api/v1/auth/refresh',
  '/api/v1/super/auth/login',
  '/api/v1/super/auth/refresh',
];

const isPublic = (url: string) => PUBLIC_URLS.some((u) => url.includes(u));

/** Clone a request and stamp it with the given Bearer token. */
function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Pass through non-API requests untouched (asset loads, etc.).
  if (!req.url.includes('/api')) return next(req);

  // Public auth endpoints — no header, no refresh on failure.
  if (isPublic(req.url)) return next(req);

  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.accessToken;
  const initial = token ? withToken(req, token) : req;

  return next(initial).pipe(
    catchError((err: HttpErrorResponse) => {
      // Only 401s on protected endpoints are worth refreshing.
      // 403s mean "authenticated but not allowed" — refresh won't help.
      // Anything else: surface as-is.
      if (err.status !== 401) return throwError(() => err);

      // No refresh token at all → nothing we can do; bounce to login.
      if (!authService.refreshToken) {
        authService.clearCredentials();
        router.navigate(['/login']);
        return throwError(() => err);
      }

      // Try to refresh. AuthService dedupes concurrent calls internally,
      // so 10 parallel 401s share ONE /auth/refresh hit.
      return authService.refreshAccessToken().pipe(
        switchMap((newToken) => next(withToken(req, newToken))),
        catchError((refreshErr) => {
          // Refresh token itself is dead — full logout + redirect.
          authService.clearCredentials();
          router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
