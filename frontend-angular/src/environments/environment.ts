/**
 * Local development environment.
 *
 * Used by `ng serve`. The backend must be running on port 8080 — the
 * Spring Boot CorsConfig must list http://localhost:4200 in CORS_ORIGINS
 * for the dev server to call it cross-origin.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1',
};
