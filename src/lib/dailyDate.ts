/** Official dailies change at midnight in Barcelona, so every player shares Spain's calendar day. */
export const DAILY_TIME_ZONE = "Europe/Madrid";

/**
 * Days ended at UTC midnight until this instant, the Barcelona midnight that starts 2026-10-13. Keeping the old
 * boundary for earlier solves stops a late-night solve from retroactively missing its day and breaking a streak.
 */
export const DAILY_TIME_ZONE_SINCE = Date.parse("2026-10-12T22:00:00Z");

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DAILY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Canonical daily-puzzle date (YYYY-MM-DD) for an instant: the day whose official puzzle was live then. */
export function dailyDate(instant: Date | string | number = new Date()): string {
  const time = new Date(instant).getTime();
  if (time < DAILY_TIME_ZONE_SINCE) return new Date(time).toISOString().slice(0, 10);
  return dayFormat.format(time);
}
