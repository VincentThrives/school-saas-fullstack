/**
 * Local development environment.
 *
 * Used by `ng serve`. The relative `/api/v1` path is rewritten by
 * `proxy.conf.json` to forward to the local Spring Boot backend on
 * port 8080. Don't put an absolute URL here — it would defeat the proxy
 * and trigger CORS errors against the dev backend.
 */
export const environment = {
  production: false,
  apiUrl: '/api/v1',
};
