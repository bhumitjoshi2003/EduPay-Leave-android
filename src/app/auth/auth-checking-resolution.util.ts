import { AuthStateService } from './auth-state.service';

/** How long a route guard is willing to wait for a still-CHECKING auth state to resolve before
 *  it must make a decision. Bounded so routing can never hang indefinitely offline — in the
 *  overwhelming majority of real cases loadCurrentUser() itself settles (it always resolves,
 *  never rejects) well before this fires; this is a defensive upper bound, not the primary path. */
const CHECKING_RESOLUTION_TIMEOUT_MS = 6000;

/**
 * Gives a still-CHECKING auth state one bounded, recoverable chance to resolve before a route
 * guard decides whether to grant access to protected content.
 *
 * This is the one place a guard is allowed to wait — and only for the narrow CHECKING case
 * (in practice: a fresh app bootstrap whose very first /auth/me hit a transient network
 * failure, so we genuinely don't know yet whether there's a valid session). It is NOT how an
 * already-AUTHENTICATED session gets re-verified — see AuthInterceptor / the dashboard's
 * visibility/online handlers for that; those never sit inside a route guard's decision.
 *
 * A timeout here means only that THIS navigation attempt could not confirm identity in time —
 * it deliberately does NOT mark the session UNAUTHENTICATED (that stays governed solely by
 * AuthStateService's own authoritative-vs-transient classification inside loadCurrentUser()).
 * loadCurrentUser() keeps running in the background past the timeout and may still resolve the
 * status correctly for a later guard evaluation.
 */
export async function resolveCheckingState(
  authState: AuthStateService,
  timeoutMs: number = CHECKING_RESOLUTION_TIMEOUT_MS,
): Promise<boolean> {
  await Promise.race([
    authState.loadCurrentUser(),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
  return authState.isAuthenticated();
}
