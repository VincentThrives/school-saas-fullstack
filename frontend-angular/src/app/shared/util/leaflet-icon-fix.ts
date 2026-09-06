import * as L from 'leaflet';

/**
 * Leaflet's default marker CSS references icon PNGs by relative
 * paths that break in Angular's build output. Point the icon URLs
 * at the copied /assets/leaflet folder (see angular.json assets
 * glob) so both the pin and its shadow render everywhere the app
 * uses a map. Call once — subsequent calls are no-ops.
 */
let applied = false;
export function fixLeafletDefaultIcon(): void {
  if (applied) return;
  applied = true;

  // The Leaflet types don't expose the private prototype hack, so
  // we cast through unknown. Same trick every leaflet-in-webpack
  // guide recommends — no runtime side effects beyond icon paths.
  const proto = (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string });
  delete proto._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
    iconUrl:       'assets/leaflet/marker-icon.png',
    shadowUrl:     'assets/leaflet/marker-shadow.png',
  });
}
