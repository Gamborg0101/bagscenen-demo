import { describe, expect, it } from "vitest";
import { gapRows, overbooking, shiftCoverage } from "./coverage";

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

  it("counts the most people present at once, so helpers taking turns share a place", () => {
    const three = { ...shift, helpersNeeded: 3 };
    const turns = shiftCoverage(three, [
      { userId: "a", windows: [{ start: t("08:00"), end: t("18:00") }] },
      { userId: "b", windows: [{ start: t("08:00"), end: t("18:00") }] },
      { userId: "c", windows: [{ start: t("08:00"), end: t("13:00") }] },
      { userId: "d", windows: [{ start: t("13:00"), end: t("18:00") }] },
    ]);
    expect(turns.helpers).toHaveLength(4);
    expect(turns.peak).toBe(3);
    expect(overbooking(turns, 3)).toBe(0);

    const crowded = shiftCoverage(three, [
      ...["a", "b", "c"].map((userId) => ({ userId, windows: [{ start: t("08:00"), end: t("18:00") }] })),
      { userId: "d", windows: [{ start: t("12:00"), end: t("14:00") }] },
    ]);
    expect(crowded.peak).toBe(4);
    expect(overbooking(crowded, 3)).toBe(1);
  });

  it("moves approved gaps aside, and brings them back if fewer than 'enough' are left", () => {
    const three = { ...shift, helpersNeeded: 3 };
    const quietEvening = [{ start: t("17:00"), end: t("21:00"), enough: 2 }];
    const allDay = (userId: string) => ({ userId, windows: [{ start: t("08:00"), end: t("18:00") }] });
    const breakAt5 = { userId: "c", windows: [{ start: t("08:00"), end: t("17:00") }] };

    const ok = shiftCoverage({ ...three, endsAt: t("21:00") }, [allDay("a"), { ...allDay("b"), windows: [{ start: t("08:00"), end: t("21:00") }] }, breakAt5], quietEvening);
    // a leaves at 18, so 18–21 has only one person: more than the approval allows.
    expect(ok.approvedGaps.map((g) => [fmt(g), g.have])).toEqual([["17:00-18:00", 2]]);
    expect(ok.gaps.map((g) => [fmt(g), g.have])).toEqual([["18:00-21:00", 1]]);

    const none = shiftCoverage(three, [allDay("a"), allDay("b"), breakAt5]);
    expect(none.gaps.map(fmt)).toEqual(["17:00-18:00"]);
    expect(none.approvedGaps).toEqual([]);
  });
});

describe("gapRows", () => {
  // Two of three on all day, except one person away 17–21 (the screenshot that started this).
  const shifts = [
    { id: "setup", startsAt: t("08:00"), endsAt: t("10:00"), helpersNeeded: 3, approvals: [] },
    { id: "day", startsAt: t("10:00"), endsAt: t("17:00"), helpersNeeded: 3, approvals: [] },
    { id: "evening", startsAt: t("17:00"), endsAt: t("21:00"), helpersNeeded: 3, approvals: [{ start: t("17:00"), end: t("21:00"), enough: 2 }] },
    { id: "late", startsAt: t("21:00"), endsAt: t("23:00"), helpersNeeded: 3, approvals: [] },
  ];
  const helpers = [
    { userId: "a", windows: [{ start: t("08:00"), end: t("23:00") }] },
    { userId: "b", windows: [{ start: t("08:00"), end: t("17:00") }, { start: t("21:00"), end: t("23:00") }] },
  ];
  const coverage = new Map(shifts.map((s) => [s.id, shiftCoverage(s, helpers, s.approvals)]));

  it("merges back-to-back gaps that read the same, across shifts", () => {
    const rows = gapRows(shifts, coverage);
    expect(rows.map((r) => [fmt(r), r.have, r.shiftIds])).toEqual([
      ["08:00-17:00", 2, ["setup", "day"]],
      ["17:00-21:00", 1, ["evening"]],
      ["21:00-23:00", 2, ["late"]],
    ]);
    expect(rows[0].parts.map((p) => [p.shiftId, fmt(p)])).toEqual([
      ["setup", "08:00-10:00"],
      ["day", "10:00-17:00"],
    ]);
  });

  it("flags a gap whose approval no longer holds", () => {
    const rows = gapRows(shifts, coverage);
    expect(rows.map((r) => r.reapproved)).toEqual([null, 2, null]);
  });

  it("keeps rows apart when the shifts need different numbers", () => {
    const two = shifts.map((s) => (s.id === "day" ? { ...s, helpersNeeded: 4 } : s));
    const cov = new Map(two.map((s) => [s.id, shiftCoverage(s, helpers, s.approvals)]));
    expect(gapRows(two, cov).map(fmt)).toEqual(["08:00-10:00", "10:00-17:00", "17:00-21:00", "21:00-23:00"]);
  });
});
