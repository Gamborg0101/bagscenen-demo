// Own time windows: whole shifts are free to take, but an own time window is an application the
// coordinator must OK. Until then the rest of the place in the shifts it touches is held,
// so other helpers can't take it.
// Pure module: the coverage function is passed in (eventCoverage in practice), so it can be tested.
import type { Availability, InvitationStatus, PartialApproval, Shift } from "@prisma/client";
import { overbooking, shiftRange, type ShiftCoverage } from "@/lib/coverage";

export type HoldInvitation = {
  id: string;
  status: InvitationStatus;
  userId: string;
  partialApproval: PartialApproval | null;
  respondedAt: Date | null;
  availabilities: Availability[];
};
type CoverageFn = (shifts: Shift[], invitations: HoldInvitation[]) => Map<string, ShiftCoverage>;

const isHolding = (i: HoldInvitation) => i.status === "ACCEPTED" && i.partialApproval === "PENDING";

function wholeShift(i: HoldInvitation, s: Shift): Availability {
  return { id: `hold-${i.id}-${s.id}`, invitationId: i.id, shiftId: s.id, startsAt: s.startsAt, endsAt: s.endsAt };
}

function covers(i: HoldInvitation, s: Shift, shifts: Shift[], coverage: CoverageFn): boolean {
  // With one needed, "no gaps" means this helper alone is there for the whole shift.
  // (Approved gaps are dropped: they'd hide exactly the time we're asking about.)
  const one = shifts.map((x) => ({ ...x, helpersNeeded: 1, gapApprovals: [] }));
  return coverage(one, [i]).get(s.id)!.gaps.length === 0;
}

function fits(i: HoldInvitation, s: Shift, shifts: Shift[], others: HoldInvitation[], coverage: CoverageFn): boolean {
  const expanded = { ...i, availabilities: [...i.availabilities, wholeShift(i, s)] };
  return overbooking(coverage(shifts, [...others, expanded]).get(s.id)!, s.helpersNeeded) === 0;
}

/** An answer with an own time window needs the coordinator's OK (events without shifts have nothing else to pick). */
export function needsApproval(shifts: Shift[], availabilities: Pick<Availability, "shiftId">[]): boolean {
  return shifts.length > 0 && availabilities.some((a) => a.shiftId === null);
}

/** Shifts an own time window overlaps: the ones whose rest of the place is held. */
function touched(i: HoldInvitation, s: Shift): boolean {
  const r = shiftRange(s);
  return i.availabilities.some((a) => a.shiftId === null && a.startsAt < r.end && (a.endsAt === null || a.endsAt > r.start));
}

/**
 * The invitations with each pending application stretched to the whole of the shifts its own
 * windows touch, where that fits, earliest answer first, so the held places count as taken.
 */
export function withHolds(shifts: Shift[], invitations: HoldInvitation[], coverage: CoverageFn): HoldInvitation[] {
  const result = invitations.map((i) => ({ ...i }));
  const pending = result.filter(isHolding).sort((a, b) => +(a.respondedAt ?? 0) - +(b.respondedAt ?? 0));
  for (const p of pending) {
    for (const s of shifts) {
      if (!touched(p, s) || covers(p, s, shifts, coverage)) continue;
      const others = result.filter((i) => i !== p && i.status === "ACCEPTED");
      if (fits(p, s, shifts, others, coverage)) p.availabilities = [...p.availabilities, wholeShift(p, s)];
    }
  }
  return result;
}

/**
 * Carries the holds worked out for `before` over to `after`, for the answers still pending there,
 * so a change is checked against the places that were already held.
 */
export function carryHolds(before: HoldInvitation[], after: HoldInvitation[]): HoldInvitation[] {
  return after.map((i) => {
    const held = before.find((b) => b.id === i.id)?.availabilities.filter((a) => a.id.startsWith("hold-")) ?? [];
    return isHolding(i) && held.length ? { ...i, availabilities: [...i.availabilities, ...held] } : i;
  });
}
