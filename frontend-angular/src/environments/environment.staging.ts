/**
 * Web build — STAGING (Netlify).
 *
 * Built with `ng build --configuration=staging` and deployed to the
 * staging Netlify site that serves https://staging.nammavidyalaya.com.
 * Same origin as the API host, so the request is same-origin and
 * Netlify's /api/* proxy forwards to the staging Render backend.
 * Backend's CORS_ORIGINS must list https://staging.nammavidyalaya.com.
 */
export const environment = {
  production: false,
  apiUrl: 'https://samplesaas.onrender.com/api/v1',
};
