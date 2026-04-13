import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

const PUBLIC_URLS = [
  '/api/v1/auth/login',
  '/api/v1/auth/resolve-tenant',
  '/api/v1/auth/refresh',
  '/api/v1/super/auth/login',
  '/api/v1/super/auth/refresh',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip non-API requests
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  // Skip public endpoints
  if (PUBLIC_URLS.some((url) => req.url.includes(url))) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.accessToken;

  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }

  console.warn('Auth interceptor: No token available for', req.url);
  return next(req);
};
