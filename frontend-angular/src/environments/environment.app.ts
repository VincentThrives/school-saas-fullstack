/**
 * Capacitor (Android APK) build.
 *
 * Built with `ng build --configuration=app`. Inside the WebView the origin
 * is `https://localhost` — there's no proxy and no Netlify redirect — so
 * the API URL MUST be absolute. Points directly at the Render-hosted
 * Spring Boot backend.
 *
 * If you ever rename or move the backend, update this URL here AND make
 * sure the new origin is in the backend's CORS_ORIGINS env var.
 */
export const environment = {
  production: true,
  apiUrl: 'https://samplesaas.onrender.com/api/v1',
};
