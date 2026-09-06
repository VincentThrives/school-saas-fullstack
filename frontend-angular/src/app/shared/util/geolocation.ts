import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';

/**
 * Cross-platform "get me a GPS fix" that hides the fact that Capacitor
 * WebViews don't hand `navigator.geolocation` through to the OS on their
 * own — the WebView call succeeds ONLY on web and iOS. On Android it
 * silently reports PERMISSION_DENIED because the system permission
 * prompt never fires (there's no runtime bridge).
 *
 * <p>Solution: on native platforms we route through the official
 * {@code @capacitor/geolocation} plugin — it calls into Android's native
 * LocationManager and shows the ACCESS_FINE_LOCATION runtime prompt on
 * first invocation. On plain web we keep using {@code navigator.geolocation}
 * because browsers show the permission prompt just fine.</p>
 *
 * <p>The returned object is shaped like the browser's
 * {@code GeolocationPosition} so existing callers keep working without
 * having to know which platform they're on.</p>
 *
 * <p>On rejection we return an Error with a numeric {@code code} property
 * matching {@code GeolocationPositionError} constants — this lets callers
 * that already do {@code err.code === err.PERMISSION_DENIED} keep the
 * same shape (we set {@code PERMISSION_DENIED = 1} etc. on the error
 * instance too for defensive reads).</p>
 */
export async function getCurrentPositionAsync(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
  },
): Promise<GeolocationPosition> {
  if (Capacitor.isNativePlatform()) {
    // Ensure the runtime permission has been requested (Android 6+ won't
    // deliver a fix without it, and there's no free re-prompt after the
    // user denies "Don't ask again" — we do the polite check-then-ask).
    let status = await Geolocation.checkPermissions();
    const granted = (s: string | undefined) => s === 'granted';
    if (!granted(status.location) && !granted(status.coarseLocation)) {
      status = await Geolocation.requestPermissions({
        permissions: ['location', 'coarseLocation'],
      });
    }
    if (!granted(status.location) && !granted(status.coarseLocation)) {
      throw makePermissionError();
    }

    const pos: Position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15000,
      maximumAge: options.maximumAge ?? 5000,
    });

    return {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude ?? null,
        altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
      } as GeolocationCoordinates,
      timestamp: pos.timestamp,
    } as GeolocationPosition;
  }

  // Web fallback — same behaviour the app has always had in the browser.
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(makeUnavailableError());
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** True if the current platform can be asked for a location fix at all.
 *  Native builds always have geolocation available via the plugin; on
 *  web we defer to the browser's {@code navigator.geolocation} presence. */
export function isGeolocationAvailable(): boolean {
  return Capacitor.isNativePlatform() || !!navigator.geolocation;
}

// GeolocationPositionError constants — replicated so we don't lean on
// the global type at runtime (it isn't present in every embedded WebView).
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

function makePermissionError(): any {
  const err: any = new Error('Location permission denied');
  err.code = PERMISSION_DENIED;
  err.PERMISSION_DENIED = PERMISSION_DENIED;
  err.POSITION_UNAVAILABLE = POSITION_UNAVAILABLE;
  err.TIMEOUT = TIMEOUT;
  return err;
}

function makeUnavailableError(): any {
  const err: any = new Error('Geolocation unavailable');
  err.code = POSITION_UNAVAILABLE;
  err.PERMISSION_DENIED = PERMISSION_DENIED;
  err.POSITION_UNAVAILABLE = POSITION_UNAVAILABLE;
  err.TIMEOUT = TIMEOUT;
  return err;
}
