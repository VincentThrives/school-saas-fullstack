/**
 * Capacitor (Android APK) build — STAGING.
 *
 * Built with `ng build --configuration=app-staging`. Inside the WebView the
 * origin is `https://localhost`, so the API URL must be absolute. Points
 * at the staging domain (Netlify proxies /api/* to the staging Render
 * backend). The new origin must be in the staging backend's CORS_ORIGINS
 * env var.
 */
export const environment = {
  production: false,
  apiUrl: 'https://staging.nammavidyalaya.com/api/v1',
};
