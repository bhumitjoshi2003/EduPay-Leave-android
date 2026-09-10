const REDIRECT_URL_KEY = 'redirectUrl';

/**
 * Records the given URL as where the user should land after their next successful login —
 * but only when it's a genuine same-origin internal path. Never an absolute/external URL
 * (which a redirect target must never become), and never a bare "//" (browsers treat a
 * leading "//" as protocol-relative, i.e. a different host).
 */
export function saveIntendedRoute(url: string | null | undefined): void {
  if (url && url.startsWith('/') && !url.startsWith('//')) {
    localStorage.setItem(REDIRECT_URL_KEY, url);
  }
}

/** Reads and clears the saved intended route, defaulting to /dashboard. */
export function consumeIntendedRoute(): string {
  const url = localStorage.getItem(REDIRECT_URL_KEY) || '/dashboard';
  localStorage.removeItem(REDIRECT_URL_KEY);
  return url;
}

/** Clears any saved intended route without reading it (e.g. on logout). */
export function clearIntendedRoute(): void {
  localStorage.removeItem(REDIRECT_URL_KEY);
}
