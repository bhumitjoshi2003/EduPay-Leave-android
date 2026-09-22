import { CalendarEvent } from '../interfaces/event-calendar.component';

/** The moment this event actually begins — startTime if given, else midnight of startDate.
 *  Used only to order multiple eligible events, never for the eligibility check itself. */
function startMoment(event: CalendarEvent): Date {
  return new Date(`${event.startDate}T${event.startTime ?? '00:00:00'}`);
}

/** The last moment this event should still count as "upcoming" — its own start time once
 *  given (an event with a specific time has passed once that time is reached), or the end of
 *  its start date for an all-day event (no specific time), so an all-day event stays visible
 *  for the whole day it happens rather than disappearing at midnight. */
function lastEligibleMoment(event: CalendarEvent): Date {
  return new Date(`${event.startDate}T${event.startTime ?? '23:59:59'}`);
}

/**
 * Picks the single nearest not-yet-started (or still-today, for all-day events) event from a
 * list — the compact "Upcoming Event" dashboard signal. Reused unchanged for a next-month
 * fallback list too: every date in a future month is trivially past `now`, so the same
 * eligibility check applies with no special-casing.
 */
export function pickNearestUpcomingEvent(events: CalendarEvent[], now: Date): CalendarEvent | null {
  const eligible = events.filter(event => lastEligibleMoment(event) >= now);
  if (eligible.length === 0) return null;
  return eligible.reduce((nearest, candidate) =>
    startMoment(candidate) < startMoment(nearest) ? candidate : nearest
  );
}
