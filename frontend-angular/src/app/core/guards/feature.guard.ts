import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const featureGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredFeature = route.data?.['feature'] as string | undefined;

  if (!requiredFeature) {
    return true;
  }

  if (authService.isFeatureEnabled(requiredFeature)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
