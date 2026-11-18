import type { Availability, Shift } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { overbooking, shiftCoverage } from "@/lib/coverage";
import { carryHolds, needsApproval, withHolds, type HoldInvitation } from "./holds";

const t = (hhmm: string) => new Date(`2026-10-22T${hhmm}:00Z`);

const shift = (id: string, from: string, to: string, helpersNeeded: number): Shift => ({
  id,
  eventId: "e",
  kind: "AFVIKLING",
  label: null,
  startsAt: t(from),
  endsAt: t(to),
  durationMinutes: null,
  helpersNeeded,
  notes: null,
});

// A stand-in for eventCoverage (fixed-time shifts only): whole-shift rows follow the shift's times.
function coverage(shifts: Shift[], invitations: HoldInvitation[]) {
  return new Map(
    shifts.map((s) => {
      const helpers = invitations
        .filter((i) => i.status === "ACCEPTED")
        .map((i) => ({
          userId: i.userId,
          windows: i.availabilities.map((a) => {
            const own = shifts.find((x) => x.id === a.shiftId);
            return own ? { start: own.startsAt, end: own.endsAt } : { start: a.startsAt, end: a.endsAt };
          }),
        }));
      return [s.id, shiftCoverage(s, helpers)];
    }),
  );
}

let n = 0;
const takes = (shiftId: string, s: Shift): Availability => ({ id: `a${n++}`, invitationId: "", shiftId, startsAt: s.startsAt, endsAt: s.endsAt });
const window = (from: string, to: string): Availability => ({ id: `a${n++}`, invitationId: "", shiftId: null, startsAt: t(from), endsAt: t(to) });
const helper = (id: string, availabilities: Availability[], partialApproval: HoldInvitation["partialApproval"] = null, at = "00:00"): HoldInvitation => ({
  id,
  userId: `u-${id}`,
  status: "ACCEPTED",
  partialApproval,
  respondedAt: t(at),
  availabilities,
});

const evening = shift("evening", "08:00", "21:00", 2);
const setup = shift("setup", "06:00", "08:00", 1);

/** Would `newcomer` overbook a shift, given the places held before they answered? */
function blocked(shifts: Shift[], before: HoldInvitation[], newcomer: HoldInvitation) {
  const held = withHolds(shifts, before, coverage);
  const after = carryHolds(held, [...before, newcomer]);
  return shifts.some((s) => overbooking(coverage(shifts, after).get(s.id)!, s.helpersNeeded) > 0);
}

describe("needsApproval", () => {
  it("lets whole shifts through, even if not every shift is taken", () => {
    expect(needsApproval([setup, evening], [takes("evening", evening)])).toBe(false);
  });

  it("makes any own time window an application", () => {
    expect(needsApproval([setup, evening], [takes("setup", setup), window("08:00", "17:00")])).toBe(true);
  });

  it("has nothing to approve on an event without shifts", () => {
    expect(needsApproval([], [window("08:00", "17:00")])).toBe(false);
  });
});

describe("holds", () => {
  const full = helper("a", [takes("evening", evening)]);
  const partial = (approval: HoldInvitation["partialApproval"]) => helper("b", [window("08:00", "17:00")], approval);
  const lateComer = helper("c", [window("17:00", "21:00")]);

  it("keeps others out of the rest of a pending partial answer's place", () => {
    expect(blocked([evening], [full, partial("PENDING")], lateComer)).toBe(true);
  });

  it("opens the rest once the coordinator has approved", () => {
    expect(blocked([evening], [full, partial(null)], lateComer)).toBe(false);
  });

  it("holds only the shifts the own window touches", () => {
    const applicant = helper("b", [window("08:00", "17:00")], "PENDING");
    const held = withHolds([setup, evening], [full, applicant], coverage);
    expect(held.find((i) => i.id === "b")!.availabilities.map((a) => a.shiftId)).toEqual([null, "evening"]);
  });

  it("only holds what fits: a place someone else already has isn't held twice", () => {
    const two = helper("x", [takes("evening", evening)]);
    const held = withHolds([evening], [full, two, partial("PENDING")], coverage);
    expect(held.find((i) => i.id === "b")!.availabilities).toHaveLength(1);
  });

  it("gives the earlier of two pending answers the held place", () => {
    // Three needed: both are there 08–12; after 12 there's room for only one of them.
    const three = { ...evening, helpersNeeded: 3 };
    const early = helper("p1", [window("08:00", "12:00")], "PENDING", "09:00");
    const late = helper("p2", [window("08:00", "12:00")], "PENDING", "10:00");
    const afternoon = helper("q", [window("12:00", "21:00")]);
    const held = withHolds([three], [late, early, full, afternoon], coverage);
    expect(held.find((i) => i.id === "p1")!.availabilities).toHaveLength(2);
    expect(held.find((i) => i.id === "p2")!.availabilities).toHaveLength(1);
  });
});
