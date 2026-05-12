import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from './api.service';
import { TenantFeatures, User } from '../models';

/**
 * Singleton store of per-tenant feature flags. Drives UI gating across
 * the app — sidebar menu items, route guards, conditional badges, the
 * "Send via SMS" checkbox in Compose, etc.
 *
 * Loaded once at app boot from `/users/me`. Refreshed when:
 *   - User logs in (auth.service triggers via `setFromUser`)
 *   - User explicitly calls `refresh()` (e.g. after super admin enables SMS)
 *
 * Default state is everything OFF — fail-closed. UI elements that read
 * `smsEnabled()` see false until proven otherwise, so a missing
 * `/users/me` response can't accidentally expose disabled features.
 */
@Injectable({ providedIn: 'root' })
export class TenantFeatureService {
  private api = inject(ApiService);

  /** Current feature state. Signal so templates can use it directly. */
  private features = signal<TenantFeatures>({
    smsEnabled: false,
    smsAbsenceAlertEnabled: false,
    smsResultPublishEnabled: false,
    smsCustomNoticeEnabled: false,
  });

  /** ── Public derived signals — used in *ngIf and CSS class bindings ── */

  readonly smsEnabled = computed(() => this.features().smsEnabled);
  readonly absenceAlertSms = computed(() =>
    this.features().smsEnabled && this.features().smsAbsenceAlertEnabled,
  );
  readonly resultPublishSms = computed(() =>
    this.features().smsEnabled && this.features().smsResultPublishEnabled,
  );
  readonly customNoticeSms = computed(() =>
    this.features().smsEnabled && this.features().smsCustomNoticeEnabled,
  );

  /** Snapshot accessor — for non-template code paths (route guards, services). */
  current(): TenantFeatures {
    return this.features();
  }

  /** Called by AuthService on every login / token refresh. The User
   *  object from `/users/me` carries tenantFeatures inline. */
  setFromUser(user: User | null): void {
    if (!user?.tenantFeatures) {
      this.resetToDefaults();
      return;
    }
    this.features.set({ ...user.tenantFeatures });
  }

  /** Manual refresh — hits `/users/me` and re-seeds. School admins
   *  can use this from a "Refresh feature flags" button if Super Admin
   *  enabled a feature mid-session and they don't want to log out. */
  refresh(): Observable<User | null> {
    return this.api.getMyUserProfile().pipe(
      tap((res) => this.setFromUser(res?.data ?? null)),
      map((res) => res?.data ?? null),
    );
  }

  /** Called on logout — wipe the cached flags so a different user
   *  logging in on the same browser doesn't briefly see stale state. */
  resetToDefaults(): void {
    this.features.set({
      smsEnabled: false,
      smsAbsenceAlertEnabled: false,
      smsResultPublishEnabled: false,
      smsCustomNoticeEnabled: false,
    });
  }
}
