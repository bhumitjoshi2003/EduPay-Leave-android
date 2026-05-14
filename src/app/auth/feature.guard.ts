import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';

/**
 * Functional route guard that enforces feature-flag-based access control.
 *
 * Usage in routes:
 *   canActivate: [roleGuard, featureGuard],
 *   data: { roles: ['ADMIN'], featureKey: 'ANALYTICS' }
 *
 * If data.featureKey is absent, any authenticated user is allowed through.
 * On failure, the user is redirected to /dashboard.
 *
 * Note: This is a UX-only guard. The backend is always the authoritative source.
 */
export const featureGuard: CanActivateFn = (route, _state) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  const featureKey: string | undefined = route.data['featureKey'];
  if (!featureKey) return true;

  if (authState.hasFeature(featureKey)) return true;

  router.navigate(['/dashboard']);
  return false;
};
