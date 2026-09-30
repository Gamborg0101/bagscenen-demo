import "server-only";
import type { Availability, Shift } from "@prisma/client";
import { db } from "@/lib/db";
import type { Window } from "@/lib/coverage";
import { hasRole, type CurrentUser } from "@/lib/session";
import { isEventLocked } from "./response";

/**
 * Helpers may see an event once they are invited (whatever their answer),
 * as long as it is not a draft. Leads and admins may see everything.
 */
export async function viewerInvitation(user: CurrentUser, eventId: string) {
  const invitation = await db.invitation.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    include: { availabilities: { orderBy: { startsAt: "asc" } } },
  });
  return invitation;
}

export async function canViewEvent(user: CurrentUser, eventId: string, status: string): Promise<boolean> {
  if (hasRole(user.role, "LEAD")) return true;
  if (status === "DRAFT") return false;
  const inv = await db.invitation.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    select: { id: true },
  });
  return !!inv;
}

/** Everyone invited to the event, with their windows, for coverage and co-helper lists. */
export function eventInvitations(eventId: string) {
  return db.invitation.findMany({
    where: { eventId },
    orderBy: [{ status: "asc" }, { user: { firstName: "asc" } }],
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, anonymizedAt: true } },
      availabilities: { orderBy: { startsAt: "asc" } },
    },
  });
}

export type EventInvitation = Awaited<ReturnType<typeof eventInvitations>>[number];

export function eventNotes(eventId: string) {
  return db.eventNote.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" }, // newest first
    include: { author: { select: { id: true, firstName: true, lastName: true, anonymizedAt: true } } },
  });
}

export type EventNoteWithAuthor = Awaited<ReturnType<typeof eventNotes>>[number];

/**
 * The time an availability actually covers. Fixed shifts follow the shift's current times;
 * duration shifts and custom windows use the times the helper chose.
 */
export function availabilityWindow(a: Availability, shifts: Shift[]): Window {
  const shift = a.shiftId ? shifts.find((s) => s.id === a.shiftId) : undefined;
  return shift && shift.durationMinutes == null ? { start: shift.startsAt, end: shift.endsAt } : { start: a.startsAt, end: a.endsAt };
}

/**
 * Who may edit an event's channel plans: coordinators always; helpers who said yes,
 * until the event is over.
 */
export async function canEditPlans(user: CurrentUser, event: { id: string; startsAt: Date; endsAt: Date | null }): Promise<boolean> {
  if (hasRole(user.role, "LEAD")) return true;
  if (isEventLocked(event)) return false;
  const inv = await db.invitation.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    select: { status: true },
  });
  return inv?.status === "ACCEPTED";
}
