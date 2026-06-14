/**
 * Cross-platform blob download/open helper.
 *
 * <p>Browser path: the standard "create a hidden anchor with
 * download=, click it, revoke" trick — fast and Just Works in every
 * modern desktop browser.</p>
 *
 * <p>Capacitor (Android) WebView path: the anchor-click pattern fails
 * silently — the WebView doesn't honour the {@code download}
 * attribute, blob: URLs aren't routed to the system download manager,
 * and synthetic clicks on an off-screen anchor don't trigger an
 * Intent. The result: a parent tapping "Download PDF" sees nothing
 * happen.</p>
 *
 * <p>Workaround that needs no new Capacitor plugins: read the blob as
 * a base64 data URL and {@code window.open(...)} it. Capacitor's
 * default bridge routes {@code _blank} navigation through Android's
 * Intent system, which knows how to render a {@code data:application/pdf}
 * URL via the system PDF viewer (Drive, Adobe, etc.). The user gets
 * the file opened inline; saving it then becomes the system viewer's
 * "Save" / "Share" button, which is what parents on mobile expect
 * anyway.</p>
 *
 * <p>If the launch needs true "save to Downloads folder" semantics on
 * Android, install {@code @capacitor/filesystem} and switch the
 * native branch to {@code Filesystem.writeFile}. Out of scope for the
 * quick JS-only fix this file ships.</p>
 */

/** Best-effort detection of a Capacitor native runtime without adding
 *  a hard dependency on {@code @capacitor/core}. The global is set by
 *  the Capacitor bridge at app boot. */
export function isCapacitorNative(): boolean {
  const cap: any = (window as any)?.Capacitor;
  if (!cap) return false;
  // Modern API
  if (typeof cap.isNativePlatform === 'function') {
    try { return !!cap.isNativePlatform(); } catch { /* fall through */ }
  }
  // Older fallback — "web" means browser, anything else is native.
  if (typeof cap.getPlatform === 'function') {
    try { return cap.getPlatform() !== 'web'; } catch { /* fall through */ }
  }
  return false;
}

/**
 * Save a blob as a file (browser) or open it via the system viewer
 * (native). Returns void; failures bubble through a console warn so a
 * silent no-op never confuses the user — call sites should wrap in a
 * try/catch and surface a snackbar if they want a visible error.
 */
export function downloadOrOpenBlob(blob: Blob, filename: string): void {
  if (isCapacitorNative()) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // _blank routes through the WebView's bridge; Capacitor delegates
      // unknown schemes (data:application/pdf, http(s):) to the
      // platform browser / PDF intent on Android.
      try {
        window.open(dataUrl, '_blank');
      } catch (e) {
        console.warn('downloadOrOpenBlob: native window.open failed', e);
      }
    };
    reader.onerror = () => {
      console.warn('downloadOrOpenBlob: FileReader failed to read blob');
    };
    reader.readAsDataURL(blob);
    return;
  }

  // Browser path — the long-standing anchor-click trick.
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke a tick so Safari has time to start the download
  // before the URL becomes invalid.
  setTimeout(() => window.URL.revokeObjectURL(url), 0);
}
