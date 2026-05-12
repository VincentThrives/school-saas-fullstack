import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PushService } from './core/services/push.service';
import { TenantFeatureService } from './core/services/tenant-feature.service';
import { distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'frontend-angular';

  constructor(
    private auth: AuthService,
    private push: PushService,
    private features: TenantFeatureService,
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
  }
}
