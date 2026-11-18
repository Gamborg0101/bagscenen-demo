// Geometry for the coverage timeline: maps times onto 0–100% of an axis.
import type { Range, Window } from "./coverage";
import { toDateInput, toTimeInput } from "./datetime";

export type Axis = { start: Date; end: Date };
export type Bar = { left: number; width: number; openEnd: boolean };

const HOUR = 3600_000;
/** Helper windows this close to the shifts widen the axis; ones further away are shown as edge markers. */
const REACH = 6 * HOUR;
const MAX_TICKS = 8; // labels don't collide at 390px
const STEPS = [1, 2, 3, 4, 6, 12, 24, 48, 168];

/**
 * Axis over the core ranges (the shifts), widened by extra ranges (helpers' windows) that touch
 * or lie within a few hours of them, snapped out to whole hours. A stray window days away must
 * not squash the whole event into a sliver.
 */
export function axisFor(core: Range[], extra: Range[] = []): Axis | null {
  const base = core.length ? core : extra;
  if (base.length === 0) return null;
  let min = Math.min(...base.map((r) => +r.start));
  let max = Math.max(...base.map((r) => +r.end));
  const near = extra.filter((r) => +r.end >= min - REACH && +r.start <= max + REACH);
  for (const r of near) {
    min = Math.min(min, +r.start);
    max = Math.max(max, +r.end);
  }
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

/** Which side of the axis a window lies on, if it lies wholly outside it. */
export function outside(axis: Axis, w: Window): "before" | "after" | null {
  if (w.start >= axis.end) return "after";
  // An open-ended window ("until done") that started earlier is still running: it gets a bar.
  if (w.end !== null && w.end <= axis.start) return "before";
  return null;
}

/** Hours between ticks: the smallest step that keeps the axis to a handful of labels. */
export function tickStep(axis: Axis): number {
  const hours = (+axis.end - +axis.start) / HOUR;
  return STEPS.find((s) => hours / s <= MAX_TICKS) ?? Math.ceil(hours / MAX_TICKS / 24) * 24;
}

/** Ticks on whole local hours divisible by the step (midnights for day steps). */
export function ticks(axis: Axis): Date[] {
  const step = tickStep(axis);
  const out: Date[] = [];
  // Walk hours (DST makes local midnights uneven in UTC); stop once a handful of ticks is found.
  for (let t = +axis.start; t <= +axis.end && out.length <= MAX_TICKS; t += HOUR) {
    const d = new Date(t);
    const hour = Number(toTimeInput(d).slice(0, 2));
    const onStep = step < 24 ? hour % step === 0 : hour === 0 && daysSince(axis.start, d) % (step / 24) === 0;
    if (onStep) out.push(d);
  }
  return out;
}

/** "16" for hour ticks; "20/11" for midnights on axes longer than a day. */
export function tickLabel(axis: Axis, t: Date): string {
  const [hh] = toTimeInput(t).split(":");
  if (hh === "00" && +axis.end - +axis.start > 24 * HOUR) {
    const [, m, d] = toDateInput(t).split("-");
    return `${Number(d)}/${Number(m)}`;
  }
  return hh;
}

function daysSince(a: Date, b: Date): number {
  return Math.round((Date.parse(toDateInput(b)) - Date.parse(toDateInput(a))) / (24 * HOUR));
}
