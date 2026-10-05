// Day view grid constants (frame 04): 64px per hour, matching
// design/html's `.cal-hours .h{height:64px}`.
export const DAY_START_MIN = 8 * 60; // 08:00
export const DAY_END_MIN = 19 * 60; // 19:00
export const PX_PER_HOUR = 64;
export const PX_PER_MIN = PX_PER_HOUR / 60;
export const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;

export function minutesFromMidnight(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Monday-start week, matching frame 13's date-pill strip (H M M E P Sh D). */
export function startOfWeek(ts: number): number {
  const dayStart = startOfDay(ts);
  const mondayOffset = (new Date(dayStart).getDay() + 6) % 7;
  return addDays(dayStart, -mondayOffset);
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function minutesToY(min: number): number {
  return (min - DAY_START_MIN) * PX_PER_MIN;
}

/** Vertical offset in px from the grid's top for a given timestamp. */
export function timeToY(ts: number): number {
  return minutesToY(minutesFromMidnight(ts));
}

export function durationToHeight(startTs: number, endTs: number): number {
  return Math.max(20, ((endTs - startTs) / 60000) * PX_PER_MIN);
}

/** Inverse of minutesToY -- pixel offset from the grid's top back to a
 * minutes-from-midnight value, for drag/resize pointer math. */
export function yToMinutes(y: number): number {
  return y / PX_PER_MIN + DAY_START_MIN;
}

export const DRAG_SNAP_MIN = 15;

export function snapMinutes(min: number, step: number = DRAG_SNAP_MIN): number {
  return Math.round(min / step) * step;
}

/** `?date=YYYY-MM-DD` <-> local-midnight timestamp, so the calendar's date
 * is URL state per design/IMPLEMENTATION_BRIEF.md's route table
 * ("/calendar?date=&appt="). */
export function dateParamToTimestamp(param: string | null): number {
  if (!param) return startOfDay(Date.now());
  const [y, m, d] = param.split("-").map(Number);
  if (!y || !m || !d) return startOfDay(Date.now());
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function timestampToDateParam(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDayHeading(ts: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ts));
}

export function formatHour(minutesFromMidnightValue: number, locale: string): string {
  const d = new Date();
  d.setHours(Math.floor(minutesFromMidnightValue / 60), minutesFromMidnightValue % 60, 0, 0);
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatTime(ts: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

export function formatTimeRange(start: number, end: number, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
}
