import { HttpErrorResponse } from '@angular/common/http';

export type AuthFailureKind = 'AUTHORITATIVE' | 'TRANSIENT';

/**
 * Single, shared classification for a failed auth-check/refresh response — used by
 * AuthStateService and AuthInterceptor so they can never drift into slightly different
 * definitions of "the session is really gone" vs. "we just couldn't verify it right now".
 *
 * AUTHORITATIVE (only 401/403): the server has actually looked at the request and said this
 * session cannot continue — safe to clear auth and treat the user as logged out.
 *
 * TRANSIENT (everything else — status 0, timeouts, 502/503/504, or any other unexpected
 * response): the server was never meaningfully consulted, or is itself temporarily unwell.
 * A transport failure is never proof that credentials are invalid, so this must never clear
 * an existing session — the caller should leave whatever state it already had alone and let
 * a later request/resume/online-event retry.
 */
export function classifyAuthFailure(error: unknown): AuthFailureKind {
  if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
    return 'AUTHORITATIVE';
  }
  return 'TRANSIENT';
}
