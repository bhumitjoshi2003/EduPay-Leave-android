import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { saveIntendedRoute } from './redirect-url.util';
import { resolveCheckingState } from './auth-checking-resolution.util';

/**
 * Three-way on AuthStateService's status, not just isLoggedIn():
 * - AUTHENTICATED (isLoggedIn() true): proceed, subject to the password-change check.
 * - CHECKING: NOT a definitive logout — give it one bounded, recoverable chance to resolve
 *   (see resolveCheckingState) rather than immediately bouncing an unconfirmed session to
 *   /home. Never grants access without a confirmed AUTHENTICATED result, though — "don't log
 *   the user out" is not the same guarantee as "let them into protected content".
 * - UNAUTHENTICATED (neither of the above): a real, confirmed rejection — redirect.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  if (authState.isLoggedIn()) {
    if (authState.mustChangePassword()) {
      router.navigate(['/change-initial-password']);
      return false;
    }
    return true;
  }

  if (authState.isChecking()) {
    // Save the intended route regardless of how this particular attempt resolves — if it times
    // out, the next successful check (a later visit, an `online` event, HomeComponent's own
    // already-logged-in bounce) can still land the user where they meant to go.
    saveIntendedRoute(state.url);
    return resolveCheckingState(authState).then(authenticated => {
      if (!authenticated) {
        router.navigate(['/home']);
        return false;
      }
      if (authState.mustChangePassword()) {
        router.navigate(['/change-initial-password']);
        return false;
      }
      return true;
    });
  }

  saveIntendedRoute(state.url);
  router.navigate(['/home']);
  return false;
};
