import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Native push notifications via Firebase Cloud Messaging.
 *
 * No-ops on non-native platforms (i.e. when running in a browser via
 * `ng serve` or the Netlify deploy) — push only makes sense inside the
 * Capacitor Android shell, where the WebView talks to FCM through the
 * Capacitor plugin.
 *
 * Lifecycle:
 *   1. Caller (auth flow on login success) invokes `init()`.
 *   2. We request notification permission (Android 13+ shows the OS prompt).
 *   3. We register with FCM → receive a device token.
 *   4. POST the token to /devices/register so the backend can target this
 *      device when sending notifications.
 *   5. Listen for incoming notifications:
 *       - `pushNotificationReceived` fires when the app is OPEN.
 *       - `pushNotificationActionPerformed` fires when the user TAPS a
 *         notification while the app is closed/backgrounded.
 *
 * On logout, call `unregister()` to drop the token from the backend so
 * the user stops receiving pushes after sign-out.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private currentToken: string | null = null;
  private initialized = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  /** True only in the Capacitor shell (Android APK). False in browser. */
  private get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Wire up listeners and register for FCM. Idempotent — calling twice
   * does nothing the second time.
   *
   * Should be called once after a successful login. Calling before login
   * works too (registration happens regardless), but the backend can't
   * associate the token with a user until JWT is in place — so login is
   * the right moment.
   */
  async init(): Promise<void> {
    if (!this.isNative || this.initialized) return;
    this.initialized = true;

    // Permission flow:
    //   - On Android 13+ this triggers the OS-level "Allow notifications?"
    //     dialog the first time.
    //   - On older Android the permission is granted at install time, so
    //     `requestPermissions()` returns granted immediately.
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[Push] Notification permission denied by user');
      return;
    }

    // Wire up event listeners BEFORE register() so we don't miss the token.
    PushNotifications.addListener('registration', (token: Token) => {
      this.currentToken = token.value;
      this.sendTokenToBackend(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] FCM registration failed:', err);
    });

    // Foreground notification: app is open, user is using it.
    // We don't show a system banner here (Android suppresses the system
    // notification when the app is foregrounded); show an in-app toast
    // instead so the user knows something arrived.
    PushNotifications.addListener('pushNotificationReceived', (n: PushNotificationSchema) => {
      const text = n.title ? `${n.title}: ${n.body || ''}` : (n.body || 'New notification');
      this.snackBar.open(text, 'View', { duration: 5000 })
        .onAction()
        .subscribe(() => this.handleNotificationData(n.data));
    });

    // User tapped a notification while the app was backgrounded/closed.
    // The data payload tells us where to navigate.
    PushNotifications.addListener('pushNotificationActionPerformed', (a: ActionPerformed) => {
      this.handleNotificationData(a.notification.data);
    });

    // Kick off FCM registration. Triggers the `registration` listener above.
    await PushNotifications.register();
  }

  /** POST the token to the backend so it can target this device. */
  private sendTokenToBackend(token: string): void {
    this.api.registerDeviceToken(token, 'ANDROID').subscribe({
      next: () => console.log('[Push] Device token registered with backend'),
      error: (err) => console.error('[Push] Failed to register token:', err),
    });
  }

  /**
   * Route based on the notification's data payload. Backend sets
   * `data.url` to a deep link when creating notifications:
   *   - "/fees"      → user lands on fee status
   *   - "/exams/123" → opens specific exam
   *
   * Falls back to the dashboard if no url is given.
   */
  private handleNotificationData(data: any): void {
    if (!data) return;
    const url = data.url || data.route || '/dashboard';
    this.router.navigateByUrl(url).catch(() => {
      // If the route doesn't exist (app version skew), at least land on dashboard.
      this.router.navigateByUrl('/dashboard');
    });
  }

  /** On logout, drop the token so this device stops receiving pushes for
   *  the previous user. The next login will register a fresh token. */
  async unregister(): Promise<void> {
    if (!this.isNative || !this.currentToken) return;
    const token = this.currentToken;
    this.currentToken = null;
    this.initialized = false;

    this.api.unregisterDeviceToken(token).subscribe({
      next: () => console.log('[Push] Token deregistered from backend'),
      error: () => { /* non-fatal — token will eventually expire on FCM side */ },
    });

    // Remove all listeners so a future login re-binds cleanly.
    try {
      await PushNotifications.removeAllListeners();
    } catch { /* ignore — plugin not initialized */ }
  }
}
