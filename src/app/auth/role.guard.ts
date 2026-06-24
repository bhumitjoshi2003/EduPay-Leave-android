import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';

/**
 * Functional route guard that enforces role-based access control.
 *
 * Usage in routes:
 *   canActivate: [roleGuard],
 *   data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
 *
 * If data.roles is absent or empty, any authenticated user is allowed through.
 * On failure, the user is redirected to /dashboard (the default landing page).
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  if (!authState.isLoggedIn()) {
    localStorage.setItem('redirectUrl', state.url);
    router.navigate(['/home']);
    return false;
  }

  const allowedRoles: string[] = route.data['roles'] ?? [];

  if (!route.data?.['roles'] || route.data['roles'].length === 0) {
    console.warn(`[RoleGuard] Route "${route.routeConfig?.path}" has no role requirements — verify this is intentional.`);
  }

  if (allowedRoles.length === 0) {
    return true;
  }

  const userRole = authState.getUserRole();

  if (allowedRoles.includes(userRole)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
