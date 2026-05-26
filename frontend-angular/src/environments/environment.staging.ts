/**
 * Web + APK build — STAGING.
 *
 * Used by `ng build --configuration=staging` for both the staging
 * Netlify site (https://staging.nammavidyalaya.com) and the staging
 * APK flavor. apiUrl points directly at the staging Render backend,
 * bypassing the Netlify /api/* proxy. Backend's CORS_ORIGINS must
 * list https://staging.nammavidyalaya.com and https://localhost
 * (APK WebView).
 */
export const environment = {
  production: false,
  apiUrl: 'https://samplesaas.onrender.com/api/v1',
};
