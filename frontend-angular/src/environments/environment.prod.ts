/**
 * Web + APK build — PRODUCTION.
 *
 * Used by `ng build --configuration=production` for both the prod
 * Netlify site (https://www.nammavidyalaya.com) and the prod AAB.
 * apiUrl points at our branded api subdomain (CNAME → Render) so
 * the raw onrender.com host never leaks into browser DevTools /
 * dealer network traces. Backend's CORS_ORIGINS must list
 * https://www.nammavidyalaya.com and https://localhost (APK WebView).
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.nammavidyalaya.com/api/v1',
};
