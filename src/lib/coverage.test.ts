import { describe, expect, it } from "vitest";
import { shiftCoverage } from "./coverage";

const t = (hhmm: string) => new Date(`2026-10-22T${hhmm}:00Z`);
const fmt = (r: { start: Date; end: Date }) => `${r.start.toISOString().slice(11, 16)}-${r.end.toISOString().slice(11, 16)}`;

describe("shiftCoverage", () => {
  const shift = { id: "s", startsAt: t("08:00"), endsAt: t("18:00"), helpersNeeded: 1 };

  it("finds the lecture gap in a split availability (08–11 + 13:15–18)", () => {
    const c = shiftCoverage(shift, [
      { userId: "helper-a", windows: [{ start: t("08:00"), end: t("11:00") }, { start: t("13:15"), end: t("18:00") }] },
    ]);
    expect(c.helpers[0].full).toBe(false);
    expect(c.gaps.map(fmt)).toEqual(["11:00-13:15"]);
  });

  it("fills the gap with a second helper and merges overlaps", () => {
    const c = shiftCoverage(shift, [
      { userId: "helper-a", windows: [{ start: t("08:00"), end: t("11:00") }, { start: t("13:15"), end: t("18:00") }] },
      { userId: "helper-b", windows: [{ start: t("10:00"), end: t("12:00") }, { start: t("11:30"), end: t("14:00") }] },
    ]);
    expect(c.gaps).toEqual([]);
    expect(c.helpers.find((h) => h.userId === "helper-b")!.ranges.map(fmt)).toEqual(["10:00-14:00"]);
  });

  it("reports how many are present in each gap when more are needed", () => {
    const c = shiftCoverage({ ...shift, helpersNeeded: 2 }, [
      { userId: "a", windows: [{ start: t("08:00"), end: t("18:00") }] },
      { userId: "b", windows: [{ start: t("12:00"), end: t("18:00") }] },
    ]);
    expect(c.helpers.find((h) => h.userId === "a")!.full).toBe(true);
    expect(c.gaps.map((g) => [fmt(g), g.have])).toEqual([["08:00-12:00", 1]]);
  });

  it("treats open-ended shifts and 'until done' windows sensibly", () => {
    const open = { id: "n", startsAt: t("18:00"), endsAt: null, helpersNeeded: 1 };
    const c = shiftCoverage(open, [{ userId: "a", windows: [{ start: t("18:00"), end: null }] }]);
    expect(c.helpers[0].full).toBe(true);
    expect(fmt(c.range)).toBe("18:00-20:00");
  });

  it("ignores windows outside the shift and reports the whole shift as a gap", () => {
    const c = shiftCoverage(shift, [{ userId: "a", windows: [{ start: t("19:00"), end: t("20:00") }] }]);
    expect(c.helpers).toEqual([]);
    expect(c.gaps.map((g) => [fmt(g), g.have])).toEqual([["08:00-18:00", 0]]);
  });
});
