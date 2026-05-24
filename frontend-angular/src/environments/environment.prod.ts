/**
 * Web build — PRODUCTION (Netlify).
 *
 * Built with `ng build --configuration=production` and deployed to the
 * prod Netlify site that serves https://www.nammavidyalaya.com. Same
 * origin as the API host, so the request is same-origin and Netlify's
 * /api/* proxy forwards to the prod Render backend. Backend's
 * CORS_ORIGINS must list https://www.nammavidyalaya.com.
 */
export const environment = {
  production: true,
  apiUrl: 'https://www.nammavidyalaya.com/api/v1',
};
