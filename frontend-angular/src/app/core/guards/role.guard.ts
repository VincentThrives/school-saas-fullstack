import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models';

/**
 * Role-based route gate. Reads {@code data.roles} off the activated
 * route and lets the navigation through when the logged-in user has
 * any of them.
 *
 * <p><b>SCHOOL_COORDINATOR elevation.</b> By design (matches the user
 * request — "same as school admin role all sidenavs but we can
 * enable or disable those from one page"), {@code SCHOOL_COORDINATOR}
 * is treated the same as {@code SCHOOL_ADMIN} for route gating: if
 * SCHOOL_ADMIN is in the required list, coordinators are allowed too.
 * This keeps the coordinator role from needing its own copy of every
 * {@code data.roles} array across the route file.</p>
 *
 * <p>Routes that must remain admin-only (user management, the
 * Coordinator Access page itself, bulk-promote) opt out with
 * {@code data.adminOnly: true} — that flag overrides the elevation
 * and forces a real SCHOOL_ADMIN role check.</p>
 *
 * <p>The tenant-level module toggle (Coordinator Access page) is
 * enforced via sidenav filtering, not here — see
 * {@code SidebarComponent.isItemVisible}. That's intentional: the
 * Coordinator role is for trusted delegation inside a school, not a
 * hostile-isolation boundary.</p>
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data?.['roles'] as UserRole[] | undefined;
  const adminOnly = route.data?.['adminOnly'] === true;

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  if (authService.hasRole(...requiredRoles)) {
    return true;
  }

  // Coordinator elevation: treat SCHOOL_COORDINATOR as SCHOOL_ADMIN
  // unless the route is explicitly admin-only.
  if (!adminOnly
      && authService.currentRole === UserRole.SCHOOL_COORDINATOR
      && requiredRoles.includes(UserRole.SCHOOL_ADMIN)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
