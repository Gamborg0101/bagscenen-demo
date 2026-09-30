import { describe, expect, it } from "vitest";
import { axisFor, barFor, ticks } from "./timeline";

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
