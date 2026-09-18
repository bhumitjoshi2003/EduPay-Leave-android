/**
 * "Show times" — a per-device viewer preference (not a school/admin setting) that a teacher
 * or student toggles on the full Timetable page. Extracted from TimetableComponent so the
 * teacher dashboard's Today's Classes section reads/writes the exact same localStorage key
 * rather than inventing a second, independent toggle that could disagree with the timetable
 * page's own state.
 */

const SHOW_TIMES_KEY = 'tt_showTimes';

/** Defaults to true (times shown) when unset or when localStorage is unavailable. */
export function isShowTimesEnabled(): boolean {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem(SHOW_TIMES_KEY) !== 'false'
    : true;
}

export function setShowTimesEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SHOW_TIMES_KEY, String(enabled));
}
