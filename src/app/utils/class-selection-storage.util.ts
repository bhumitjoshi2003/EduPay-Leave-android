/**
 * Shared helpers for persisting a user's last-selected class across page loads.
 *
 * The storage key is namespaced by schoolSlug so a value picked while using one
 * school never resurfaces as the default for a different school in the same
 * browser — and callers must always validate a restored value against the
 * freshly-loaded class list before trusting it, since SchoolClass rows (not
 * localStorage) are the source of truth for which classes exist.
 */

const KEY_PREFIX = 'lastSelectedClass';

function storageKey(schoolSlug: string | null | undefined): string {
  return `${KEY_PREFIX}:${schoolSlug ?? 'unknown'}`;
}

/**
 * Returns the stored class selection for this school if — and only if — it is
 * present in `classList`. Otherwise returns `fallback`. This is what prevents a
 * stale/foreign value from ever being restored as the current class.
 */
export function getStoredSelectedClass(
  schoolSlug: string | null | undefined,
  classList: string[],
  fallback: string
): string {
  const stored = localStorage.getItem(storageKey(schoolSlug));
  return stored && classList.includes(stored) ? stored : fallback;
}

export function setStoredSelectedClass(schoolSlug: string | null | undefined, className: string): void {
  localStorage.setItem(storageKey(schoolSlug), className);
}

export function clearStoredSelectedClass(schoolSlug: string | null | undefined): void {
  localStorage.removeItem(storageKey(schoolSlug));
}
