// Shifts never get more helpers at the same time than they need — a hard cap, also for coordinators.
import "server-only";
import type { Prisma, Shift } from "@prisma/client";
import { overbooking } from "@/lib/coverage";
import { eventCoverage, type CoverageInvitation } from "./view";

/**
 * Serialises changes to an event's sign-ups and shifts until the transaction ends,
 * so two helpers taking the last place at the same moment can't both get it.
 */
export async function lockEventStaffing(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`staffing:${eventId}`}))`;
}

type Staffing = { shifts: Shift[]; invitations: CoverageInvitation[] };

/**
 * The first shift the change overbooks further than it already is, or undefined.
 * Comparing with the state before means an event that is already overbooked can still be
 * edited (e.g. to take someone off), as long as the change doesn't make it worse.
 */
export function newlyOverbooked(before: Staffing, after: Staffing): Shift | undefined {
  const was = eventCoverage(before.shifts, before.invitations);
  const now = eventCoverage(after.shifts, after.invitations);
  return after.shifts.find((s) => {
    const old = before.shifts.find((x) => x.id === s.id);
    const oldExcess = old ? overbooking(was.get(s.id)!, old.helpersNeeded) : 0;
    return overbooking(now.get(s.id)!, s.helpersNeeded) > oldExcess;
  });
}
