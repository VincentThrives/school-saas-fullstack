import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App as CapApp, AppState } from '@capacitor/app';
import { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } from '@capawesome/capacitor-app-update';
import { AuthService } from './core/services/auth.service';
import { PushService } from './core/services/push.service';
import { TenantFeatureService } from './core/services/tenant-feature.service';
import { distinctUntilChanged, filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'frontend-angular';

  /** Wall-clock timestamp of the last user-visible interaction, used
   *  by the app-resume handler to decide whether to reload data on
   *  the way back to foreground. Set on every navigation and on
   *  every resume tick. */
  private lastActiveAt = Date.now();

  /** Milliseconds — if the app was in background this long or more,
   *  we force a full route reload on resume so every open component's
   *  ngOnInit re-runs and re-fetches with a valid token. */
  private static readonly STALE_AFTER_MS = 2 * 60 * 1000; // 2 minutes

  constructor(
    private auth: AuthService,
    private push: PushService,
    private features: TenantFeatureService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Push notifications: kick off registration whenever the user is
    // logged in, deregister on logout. Watching the access token here
    // keeps PushService decoupled from AuthService (no circular DI).
    //
    // PushService internally no-ops on non-native platforms, so the
    // browser/Netlify build is unaffected by this hook.
    //
    // We also hydrate TenantFeatureService here — when a token appears
    // (fresh login or page reload with stored token) we fetch /users/me
    // so the per-tenant SMS flags are ready before any guard or UI
    // template reads them. When the token disappears (logout), the
    // feature flags are reset to defaults (everything off).
    this.auth.token
      .pipe(distinctUntilChanged())
      .subscribe((token) => {
        if (token) {
          this.push.init();
          // Best-effort fetch — if it fails (no network, expired token,
          // etc.) the feature flags stay at safe defaults.
          this.features.refresh().subscribe({ error: () => { /* swallow */ } });
        } else {
          this.push.unregister();
          this.features.resetToDefaults();
        }
      });

    // Stamp lastActiveAt on every completed navigation so the resume
    // handler's "how long were we away" check has an accurate anchor.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => { this.lastActiveAt = Date.now(); });

    // App-resume: when the user brings the app back to foreground after
    // an overnight sleep, every screen was showing zeros because ngOnInit
    // never re-ran. Now we detect the resume, and if we've been away
    // long enough, reload the current route so all dashboards re-fetch
    // through the auth interceptor (which handles any expired-token
    // refresh silently).
    this.registerResumeHandlers();

    // Android hardware back button: on root screens (dashboard, login)
    // it should exit the app; on inner pages it navigates back like a
    // normal browser back. Capacitor's default hijacks the button and
    // does nothing on root screens, which is why customers had to use
    // the home button to leave.
    this.registerBackButtonHandler();

    // In-app update prompt — check for a newer version on Play Store.
    // Delayed a tick so it doesn't compete with login-screen render.
    setTimeout(() => this.checkForAppUpdate(), 4000);

    // Proactive token refresh on boot — if we have a stored session,
    // hit /auth/refresh immediately so every subsequent dashboard/
    // API call uses a guaranteed-fresh access token. Fixes the "open
    // app after update / next morning, dashboard shows 0" symptom
    // where multiple concurrent 401s raced through the interceptor
    // and left some requests holding a stale token.
    this.proactivelyRefreshOnBoot();
  }

  private proactivelyRefreshOnBoot(): void {
    if (!this.auth.refreshToken || !this.auth.accessToken) return;
    // Publish a pending promise so the auth interceptor holds every
    // authenticated API call until the refresh settles. Without this,
    // dashboard components fire their ngOnInit calls in parallel with
    // this refresh and can end up racing on an expired token (the
    // "dashboard shows 0 until you click something" symptom after
    // the app has been idle for a day or two).
    this.auth.bootReady = new Promise<void>((resolve) => {
      this.auth.refreshAccessToken().subscribe({
        next: () => resolve(),
        error: () => resolve(),
      });
    });
  }

  /** Wire the Capacitor App state listener AND a browser
   *  visibilitychange fallback so the resume flow works on both the
   *  Android WebView and the plain-web builds. */
  private registerResumeHandlers(): void {
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', (state: AppState) => {
        if (state.isActive) this.onResume();
      }).catch(() => { /* plugin missing on very old shells — ignore */ });
    }
    // visibilitychange also fires on Capacitor WebViews when Android
    // brings the app back to foreground, so this covers both worlds.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.onResume();
    });
  }

  private onResume(): void {
    const away = Date.now() - this.lastActiveAt;
    this.lastActiveAt = Date.now();
    // Fresh return within the same tap — leave state alone.
    if (away < AppComponent.STALE_AFTER_MS) return;

    // Re-check for a Play Store update on every meaningful resume so
    // a user who dismissed the previous prompt gets re-prompted the
    // next time they open the app. Without this, dismiss-once meant
    // "no more prompts until full cold-start", and users happily
    // ignored the nudge for weeks. Detached from the auth branch so
    // it fires even on the login screen.
    this.checkForAppUpdate();

    // No session → login screen will render anyway, nothing to refresh.
    if (!this.auth.accessToken && !this.auth.refreshToken) return;

    // Proactively refresh the access token FIRST so the upcoming route
    // reload doesn't race against interceptor-driven refreshes for the
    // multiple concurrent API calls a dashboard forkJoin fires. Same
    // bootReady gate as on cold-start — the interceptor holds every
    // authenticated request until this refresh settles, then the
    // route reload triggers ngOnInit which now fires against a fresh
    // token instead of racing on an expired one.
    this.auth.bootReady = new Promise<void>((resolve) => {
      this.auth.refreshAccessToken().subscribe({
        next: () => { resolve(); this.reloadCurrentRoute(); },
        error: () => { resolve(); this.reloadCurrentRoute(); },
      });
    });
  }

  /** Force Angular to tear down + rebuild whichever component is on
   *  screen so its ngOnInit re-fires and re-fetches data. */
  private reloadCurrentRoute(): void {
    const savedStrategy = this.router.onSameUrlNavigation;
    this.router.onSameUrlNavigation = 'reload';
    const url = this.router.url || '/';
    this.router.navigateByUrl(url, { skipLocationChange: false })
      .catch(() => { /* nav aborted — ignore */ })
      .finally(() => { this.router.onSameUrlNavigation = savedStrategy; });
  }

  /** Wire the Android hardware back button so it exits from root
   *  screens (dashboard, login) and navigates back on inner pages.
   *  Capacitor delivers a canGoBack flag with each event — when it's
   *  true we let the WebView history handle it (native back); when
   *  it's false AND we're on a root URL, we call CapApp.exitApp(). */
  private registerBackButtonHandler(): void {
    if (!Capacitor.isNativePlatform()) return;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const url = (this.router.url || '').split('?')[0];
      const isRoot = url === '/' || url === '/dashboard' || url === '/login';
      if (isRoot || !canGoBack) {
        CapApp.exitApp();
      } else {
        // Inner page — mimic the browser back arrow.
        window.history.back();
      }
    }).catch(() => { /* plugin missing on very old shells — ignore */ });
  }

  /** Ask Google Play whether a newer version of the app is live. If
   *  yes, kick off the "flexible" update — Play downloads in the
   *  background and prompts the user for a quick restart when done.
   *  No-op on web / non-Play builds.
   *
   *  Flow (matches the Play In-App Update API):
   *   1. Register a listener BEFORE starting so we don't miss the
   *      "downloaded" event on fast networks.
   *   2. Call startFlexibleUpdate — kicks off the OS-level dialog +
   *      background download.
   *   3. When the listener fires with status DOWNLOADED, call
   *      completeFlexibleUpdate — Play shows the "Restart to install"
   *      snackbar and swaps in the new APK.
   *
   *  Earlier iteration awaited completeFlexibleUpdate immediately after
   *  startFlexibleUpdate, but startFlexibleUpdate resolves once the
   *  DOWNLOAD BEGINS, not when it finishes — so the completion call
   *  fired against a still-downloading install and silently no-op'd,
   *  leaving Play Store's Update button stuck. */
  private async checkForAppUpdate(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const info = await AppUpdate.getAppUpdateInfo();
      // Self-heal: a previous flexible update finished downloading but
      // the completion call missed the DOWNLOADED event (bug we shipped
      // in an earlier release). If Play still has the APK sitting
      // ready, install it right now.
      if (info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
        await AppUpdate.completeFlexibleUpdate();
        return;
      }
      if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return;
      if (!info.flexibleUpdateAllowed) {
        // Fall back to sending user to Play Store listing if flexible
        // isn't allowed (rare; usually means priority not set).
        await AppUpdate.openAppStore();
        return;
      }
      // Arm the listener FIRST — startFlexibleUpdate resolves when the
      // download starts, so we need to be listening for the DOWNLOADED
      // state that fires when the bytes finish arriving.
      const handle = await AppUpdate.addListener(
        'onFlexibleUpdateStateChange',
        (state) => {
          if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
            AppUpdate.completeFlexibleUpdate().catch(() => { /* user dismissed */ });
            handle.remove();
          }
        });
      await AppUpdate.startFlexibleUpdate();
    } catch { /* offline / play services missing — silently skip */ }
  }
}
