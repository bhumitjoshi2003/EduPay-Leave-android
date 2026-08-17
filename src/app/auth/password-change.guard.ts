import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';

/**
 * Guards /change-initial-password itself: only a logged-in, restricted
 * (mustChangePassword) session may open it. A normal user is bounced to
 * /dashboard; a logged-out visitor is bounced to /home. Backend enforcement
 * (JwtAuthFilter's allowlist) is the real security boundary — this guard is
 * UX-only, matching the rest of the guards in this app.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  if (!authState.isLoggedIn()) {
    router.navigate(['/home']);
    return false;
  }
  if (!authState.mustChangePassword()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
