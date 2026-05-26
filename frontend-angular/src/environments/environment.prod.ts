/**
 * Web + APK build — PRODUCTION.
 *
 * Used by `ng build --configuration=production` for both the prod
 * Netlify site (https://www.nammavidyalaya.com) and the prod AAB.
 * apiUrl points directly at the prod Render backend, bypassing the
 * Netlify /api/* proxy. Backend's CORS_ORIGINS must list
 * https://www.nammavidyalaya.com and https://localhost (APK WebView).
 */
export const environment = {
  production: true,
  apiUrl: 'https://nammavidyalaya.onrender.com/api/v1',
};
