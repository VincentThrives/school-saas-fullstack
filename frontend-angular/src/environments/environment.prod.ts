/**
 * Production web build for Netlify.
 *
 * Built with `ng build --configuration=production`. The relative `/api/v1`
 * works because Netlify is configured to proxy/redirect those requests to
 * the Render backend (or because the deployed frontend lives on the same
 * origin). If the Netlify proxy ever stops working, switch this to the
 * absolute URL — same value as `environment.app.ts`.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
};
