// All times are stored in UTC and entered/displayed in Copenhagen time.
export const TZ = "Europe/Copenhagen";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(date: Date) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
  };
}

/** Offset of Copenhagen from UTC at the given instant, in ms (+1h or +2h). */
function offsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-09-24" + "15:00" (Copenhagen) → UTC Date. */
export function zonedToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle the DST switch correctly.
  let guess = naive - offsetMs(new Date(naive));
  guess = naive - offsetMs(new Date(guess));
  return new Date(guess);
}

/**
 * Like zonedToUtc, but if the resulting time is not after `after`
 * it is moved to the next day (e.g. a party ending at 01:00).
 */
export function zonedTimeAfter(date: string, time: string, after: Date): Date {
  const result = zonedToUtc(date, time);
  if (result > after) return result;
  return zonedToUtc(addDays(date, 1), time);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC Date → "YYYY-MM-DD" in Copenhagen. */
export function toDateInput(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** UTC Date → "HH:MM" in Copenhagen. */
export function toTimeInput(date: Date): string {
  const p = zonedParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

const dayFormatter = new Intl.DateTimeFormat("da-DK", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDayFormatter = new Intl.DateTimeFormat("da-DK", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "torsdag den 24. september 2026" */
export function formatDay(date: Date): string {
  const s = dayFormatter.format(date);
  // Some ICU versions omit "den"; add it for consistency.
  return /^\p{L}+ den /u.test(s) ? s : s.replace(/^(\p{L}+) /u, "$1 den ");
}

/** "tors. 24. sep." */
export function formatShortDay(date: Date): string {
  return shortDayFormatter.format(date);
}

/** "15.00" — Danish time notation. */
export function formatTime(date: Date): string {
  return toTimeInput(date).replace(":", ".");
}

/** "15.00–18.00", "18.00–" (open end), with "+1" if the end is on a later day. */
export function formatRange(start: Date, end?: Date | null, openLabel = ""): string {
  if (!end) return `${formatTime(start)}–${openLabel}`;
  const nextDay = toDateInput(end) !== toDateInput(start) ? " (+1)" : "";
  return `${formatTime(start)}–${formatTime(end)}${nextDay}`;
}

/** "tors. 22. okt. 14.05" — for timestamps like notes. */
export function formatStamp(date: Date): string {
  return `${formatShortDay(date)} ${formatTime(date)}`;
}
