import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { resolveCheckingState } from './auth-checking-resolution.util';

/**
 * Guards /change-initial-password itself: only a logged-in, restricted
 * (mustChangePassword) session may open it. A normal user is bounced to
 * /dashboard; a logged-out visitor is bounced to /home. Backend enforcement
 * (JwtAuthFilter's allowlist) is the real security boundary — this guard is
 * UX-only, matching the rest of the guards in this app.
 *
 * CHECKING is given the same bounded, recoverable chance as the other guards (see
 * resolveCheckingState) rather than being treated as an immediate logout — but the restricted
 * page is never shown without a confirmed AUTHENTICATED result either.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  const decideForAuthenticatedUser = (): boolean => {
    if (!authState.mustChangePassword()) {
      router.navigate(['/dashboard']);
      return false;
    }
    return true;
  };

  if (authState.isLoggedIn()) {
    return decideForAuthenticatedUser();
  }

  if (authState.isChecking()) {
    return resolveCheckingState(authState).then(authenticated => {
      if (!authenticated) {
        router.navigate(['/home']);
        return false;
      }
      return decideForAuthenticatedUser();
    });
  }

  router.navigate(['/home']);
  return false;
};
