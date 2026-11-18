import { describe, expect, it } from "vitest";
import { axisFor, barFor, outside, tickLabel, ticks } from "./timeline";

const t = (hhmm: string) => new Date(`2026-10-22T${hhmm}:00Z`);

describe("timeline geometry", () => {
  const axis = axisFor([
    { start: t("11:30"), end: t("13:00") },
    { start: t("13:00"), end: t("16:15") },
  ])!;

  it("snaps the axis out to whole hours", () => {
    expect([axis.start.toISOString(), axis.end.toISOString()]).toEqual(["2026-10-22T11:00:00.000Z", "2026-10-22T17:00:00.000Z"]);
  });

  it("positions bars as percentages and runs open ends to the axis end", () => {
    const bar = barFor(axis, { start: t("12:00"), end: t("14:00") })!;
    expect(bar.left).toBeCloseTo(100 / 6);
    expect(bar.width).toBeCloseTo(200 / 6);
    expect(bar.openEnd).toBe(false);
    const open = barFor(axis, { start: t("16:00"), end: null })!;
    expect(open.left).toBeCloseTo(500 / 6);
    expect(open.openEnd).toBe(true);
    expect(barFor(axis, { start: t("18:00"), end: t("19:00") })).toBeNull();
  });

  it("spaces ticks out on long axes", () => {
    expect(ticks(axis)).toHaveLength(7);
    expect(ticks({ start: t("06:00"), end: t("20:00") })).toHaveLength(8);
  });

  it("returns null without ranges", () => {
    expect(axisFor([])).toBeNull();
  });
});

describe("timeline with far-off windows and long spans", () => {
  const d = (iso: string) => new Date(iso);
  const shifts = [{ start: d("2026-11-20T15:00:00Z"), end: d("2026-11-20T23:00:00Z") }];

  it("ignores helper windows days away from the shifts, but widens for nearby ones", () => {
    const stray = { start: d("2026-11-15T21:00:00Z"), end: d("2026-11-15T23:00:00Z") };
    const early = { start: d("2026-11-20T12:00:00Z"), end: d("2026-11-20T15:00:00Z") };
    const axis = axisFor(shifts, [stray, early])!;
    expect([axis.start.toISOString(), axis.end.toISOString()]).toEqual(["2026-11-20T12:00:00.000Z", "2026-11-20T23:00:00.000Z"]);
    expect(outside(axis, stray)).toBe("before");
    expect(outside(axis, early)).toBeNull();
  });

  it("draws an open-ended window that started before the axis, not an edge marker", () => {
    const axis = axisFor(shifts)!;
    const running = { start: d("2026-11-19T21:00:00Z"), end: null };
    expect(outside(axis, running)).toBeNull();
    expect(barFor(axis, running)).toEqual({ left: 0, width: 100, openEnd: true });
    expect(outside(axis, { start: d("2026-11-21T00:00:00Z"), end: null })).toBe("after");
  });

  it("keeps a multi-day axis to a few ticks on local midnights, labelled by date", () => {
    const axis = { start: d("2026-11-15T21:00:00Z"), end: d("2026-11-20T23:00:00Z") };
    const ts = ticks(axis);
    expect(ts.length).toBeLessThanOrEqual(8);
    expect(ts.map((t) => tickLabel(axis, t))).toEqual(["16/11", "17/11", "18/11", "19/11", "20/11", "21/11"]);
  });
});
