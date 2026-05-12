import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantFeatureService } from '../services/tenant-feature.service';

/**
 * Route guard that blocks access to SMS-related routes when the
 * tenant has SMS disabled by Super Admin.
 *
 * The same gate is also enforced visually (sidebar item hidden,
 * settings cards hidden) — this guard is the belt-and-braces layer
 * for users who type the URL directly.
 *
 * Returns the user to /dashboard on block — feels like the SMS feature
 * simply doesn't exist. (No "you don't have access" toast — that
 * would imply the feature exists and they're being denied it.)
 */
export const smsFeatureGuard: CanActivateFn = () => {
  const features = inject(TenantFeatureService);
  const router = inject(Router);

  if (features.smsEnabled()) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};
