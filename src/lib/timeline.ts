// Geometry for the coverage timeline: maps times onto 0–100% of an axis.
import type { Range, Window } from "./coverage";

export type Axis = { start: Date; end: Date };
export type Bar = { left: number; width: number; openEnd: boolean };

const HOUR = 3600_000;

/** Axis from the earliest to the latest range, snapped out to whole hours. */
export function axisFor(ranges: Range[]): Axis | null {
  if (ranges.length === 0) return null;
  const min = Math.min(...ranges.map((r) => +r.start));
  const max = Math.max(...ranges.map((r) => +r.end));
  // Copenhagen is a whole-hour offset from UTC, so UTC hour boundaries are local ones.
  return { start: new Date(Math.floor(min / HOUR) * HOUR), end: new Date(Math.ceil(max / HOUR) * HOUR) };
}

export function pct(axis: Axis, t: Date): number {
  const span = +axis.end - +axis.start;
  return Math.min(100, Math.max(0, ((+t - +axis.start) / span) * 100));
}

/** A window as a bar; open-ended windows run to the axis end. Null if outside the axis. */
export function barFor(axis: Axis, w: Window): Bar | null {
  const end = w.end ?? axis.end;
  if (end <= axis.start || w.start >= axis.end) return null;
  const left = pct(axis, w.start);
  return { left, width: pct(axis, end) - left, openEnd: w.end === null };
}

/** Hour ticks; every 2nd/3rd hour on long axes so labels don't collide on phones. */
export function ticks(axis: Axis): Date[] {
  const hours = (+axis.end - +axis.start) / HOUR;
  const step = hours <= 8 ? 1 : hours <= 16 ? 2 : 3;
  const out: Date[] = [];
  for (let t = +axis.start; t <= +axis.end; t += step * HOUR) out.push(new Date(t));
  return out;
}
