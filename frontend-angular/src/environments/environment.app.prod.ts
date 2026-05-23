/**
 * Capacitor (Android APK) build — PRODUCTION.
 *
 * Built with `ng build --configuration=app-prod`. Inside the WebView the
 * origin is `https://localhost`, so the API URL must be absolute. Points
 * at the production domain (Netlify proxies /api/* to the prod Render
 * backend). The new origin must be in the prod backend's CORS_ORIGINS
 * env var.
 */
export const environment = {
  production: true,
  apiUrl: 'https://www.nammavidyalaya.com/api/v1',
};
