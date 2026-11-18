"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { lockEventStaffing, newlyOverbooked } from "@/lib/events/capacity";
import { eventFormSchema, formToDb, movedPicks } from "@/lib/events/form";
import { shiftName } from "@/lib/events/format";
import { requireUser } from "@/lib/session";
import { withEventRef } from "@/lib/events/ref";

export type SaveEventResult = { id?: string; error?: string; issues?: { path: string; message: string }[] };

export async function saveEvent(eventId: string | null, input: unknown, requestId?: string): Promise<SaveEventResult> {
  const actor = await requireUser("LEAD");
  if (eventId !== null) z.cuid().parse(eventId);
  if (requestId !== undefined) z.cuid().parse(requestId);

  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Nogle felter skal rettes.",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const { event, shifts, contacts } = formToDb(parsed.data);

  let id = eventId;
  if (id === null) {
    const created = await withEventRef(db, event.startsAt, (ref) =>
      db.event.create({
        data: {
          ...event,
          ...ref,
          createdBy: { connect: { id: actor.id } },
          contacts: { create: contacts },
          shifts: { create: shifts.map(({ id: _, ...s }) => s) }, // eslint-disable-line @typescript-eslint/no-unused-vars
        },
        select: { id: true },
      }),
    );
    id = created.id;
    await audit(actor.id, "event.create", "Event", id);

    if (requestId) {
      // The booking now lives on as an event; drop the request's copy of the organiser's data.
      const { count } = await db.eventRequest.updateMany({
        where: { id: requestId, status: "SUBMITTED" },
        data: { status: "CONVERTED", eventId: id, data: Prisma.DbNull },
      });
      if (count) await audit(actor.id, "request.convert", "EventRequest", requestId);
    }
  } else {
    const existing = await db.event.findUnique({ where: { id }, select: { shifts: { select: { id: true } } } });
    if (!existing) return { error: "Arrangementet findes ikke længere." };
    const existingShiftIds = new Set(existing.shifts.map((s) => s.id));
    const keptIds = shifts.map((s) => s.id).filter((sid): sid is string => !!sid && existingShiftIds.has(sid));

    const eventId = id;
    const full = await db.$transaction(async (tx) => {
      // Fewer helpers or moved times must not leave more people on a shift at once than it needs.
      await lockEventStaffing(tx, eventId);
      const before = await tx.shift.findMany({ where: { eventId } });
      const invitations = await tx.invitation.findMany({ where: { eventId }, include: { availabilities: true } });
      const after = before.flatMap((old) => {
        const s = shifts.find((x) => x.id === old.id);
        return s ? [{ ...old, ...s, id: old.id }] : [];
      });
      // Picks on a moved shift move with it (duration shifts keep the start the helper chose).
      const moved = movedPicks(before, shifts, invitations.flatMap((i) => i.availabilities));
      const movedById = new Map(moved.map((a) => [a.id, a]));
      const invitationsAfter = invitations.map((i) => ({ ...i, availabilities: i.availabilities.map((a) => movedById.get(a.id) ?? a) }));
      const overbooked = newlyOverbooked({ shifts: before, invitations }, { shifts: after, invitations: invitationsAfter });
      if (overbooked) return overbooked;

      await tx.event.update({ where: { id: eventId }, data: event });
      await tx.eventContact.deleteMany({ where: { eventId } });
      await tx.eventContact.createMany({ data: contacts.map((c) => ({ ...c, eventId })) });
      // Shifts keep their ids so helpers' sign-ups stay attached.
      await tx.shift.deleteMany({ where: { eventId, id: { notIn: keptIds } } });
      for (const { id: sid, ...s } of shifts) {
        if (sid && existingShiftIds.has(sid)) await tx.shift.update({ where: { id: sid }, data: s });
        else await tx.shift.create({ data: { ...s, eventId } });
      }
      for (const a of moved) await tx.availability.update({ where: { id: a.id }, data: { startsAt: a.startsAt, endsAt: a.endsAt } });
      return null;
    });
    if (full) return { error: `${shiftName(full)} har flere på samtidig, end du har sat antallet til. Ret eller meld nogen fra først.` };
    await audit(actor.id, "event.update", "Event", eventId);
  }

  revalidatePath("/admin/arrangementer");
  revalidatePath(`/admin/arrangementer/${id}`);
  return { id };
}

/** Deletes the event with its shifts, answers, contacts, notes and channel plans (e.g. a test event). */
export async function deleteEvent(formData: FormData) {
  const actor = await requireUser("LEAD");
  const id = z.cuid().parse(formData.get("eventId"));
  const { count } = await db.event.deleteMany({ where: { id } });
  if (count) await audit(actor.id, "event.delete", "Event", id);
  revalidatePath("/admin/arrangementer");
  redirect("/admin/arrangementer");
}

// ---------- Helpers on an event ----------

/**
 * Puts a named helper on the event without shifts yet; the coordinator then picks their shifts
 * with "Ret vagter". Helpers normally take shifts themselves.
 */
export async function addHelper(formData: FormData) {
  const actor = await requireUser("LEAD");
  const eventId = z.cuid().parse(formData.get("eventId"));
  const userId = z.cuid().parse(formData.get("userId"));

  const event = await db.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (event?.status !== "PUBLISHED") return;
  const user = await db.user.findFirst({ where: { id: userId, status: "ACTIVE", anonymizedAt: null }, select: { id: true } });
  if (!user) return;

  // Someone who said "Kan ikke" can still be put on (e.g. after a phone call); people already on stay as they are.
  const existing = await db.invitation.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { status: true } });
  if (existing && existing.status !== "DECLINED") return;
  await db.invitation.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId },
    update: { status: "PENDING", respondedAt: null, partialApproval: null },
  });
  await audit(actor.id, "invitation.create", "Event", eventId);
  revalidatePath(`/admin/arrangementer/${eventId}`);
}

export async function removeInvitation(formData: FormData) {
  const actor = await requireUser("LEAD");
  const id = z.cuid().parse(formData.get("invitationId"));
  const inv = await db.invitation.delete({ where: { id }, select: { eventId: true } }).catch(() => null);
  if (!inv) return;
  await audit(actor.id, "invitation.remove", "Invitation", id);
  revalidatePath(`/admin/arrangementer/${inv.eventId}`);
}


// ---------- Own time windows: applications (see src/lib/events/holds.ts) ----------

/** "Godkend": the helper's own time window stands; the rest of the place opens for others. */
export async function approvePartial(formData: FormData) {
  const actor = await requireUser("LEAD");
  const id = z.cuid().parse(formData.get("invitationId"));
  const inv = await db.invitation
    .update({ where: { id, status: "ACCEPTED", partialApproval: "PENDING" }, data: { partialApproval: null }, select: { eventId: true } })
    .catch(() => null);
  if (!inv) return;
  await audit(actor.id, "invitation.partial_approve", "Invitation", id);
  revalidateStaffing(inv.eventId);
}

/** "Afvis": the helper is taken off, and the whole place opens again. They can answer anew. */
export async function rejectPartial(formData: FormData) {
  const actor = await requireUser("LEAD");
  const id = z.cuid().parse(formData.get("invitationId"));
  const inv = await db.invitation.findUnique({ where: { id }, select: { eventId: true, status: true, partialApproval: true } });
  if (!inv || inv.status !== "ACCEPTED" || inv.partialApproval !== "PENDING") return;

  await db.$transaction(async (tx) => {
    await lockEventStaffing(tx, inv.eventId);
    await tx.availability.deleteMany({ where: { invitationId: id } });
    await tx.invitation.update({ where: { id }, data: { status: "DECLINED", partialApproval: "REJECTED", partialReason: null, respondedAt: new Date() } });
  });
  await audit(actor.id, "invitation.partial_reject", "Invitation", id);
  revalidateStaffing(inv.eventId);
}

// ---------- Approved gaps ("Det er fint") ----------

const gapPartSchema = z
  .object({
    shiftId: z.cuid(),
    startsAt: z.iso.datetime().transform((v) => new Date(v)),
    endsAt: z.iso.datetime().transform((v) => new Date(v)),
  })
  .refine((g) => g.endsAt > g.startsAt);

// One list row can span several shifts: the form repeats shiftId/startsAt/endsAt per part.
const gapSchema = z.object({
  parts: z.array(gapPartSchema).min(1).max(50),
  enough: z.coerce.number().int().min(0),
});

function revalidateStaffing(eventId: string) {
  revalidatePath(`/admin/arrangementer/${eventId}`);
  revalidatePath(`/arrangementer/${eventId}`);
  revalidatePath("/admin/arrangementer");
  revalidatePath("/");
}

/** The coordinator says fewer people are fine in part of a shift (e.g. a quiet evening). */
export async function approveGap(formData: FormData) {
  const actor = await requireUser("LEAD");
  const shiftIds = formData.getAll("shiftId");
  const startsAt = formData.getAll("startsAt");
  const endsAt = formData.getAll("endsAt");
  const { parts, enough } = gapSchema.parse({
    parts: shiftIds.map((shiftId, i) => ({ shiftId, startsAt: startsAt[i], endsAt: endsAt[i] })),
    enough: formData.get("enough"),
  });
  const shifts = await db.shift.findMany({ where: { id: { in: parts.map((p) => p.shiftId) } }, select: { id: true, eventId: true, helpersNeeded: true } });
  const eventIds = new Set(shifts.map((s) => s.eventId));
  if (shifts.length !== new Set(parts.map((p) => p.shiftId)).size || eventIds.size !== 1) return;
  if (shifts.some((s) => enough >= s.helpersNeeded)) return;

  const created = await db.$transaction(async (tx) => {
    // An approval inside the new window is superseded by it (e.g. "2 er nok" that no longer holds).
    for (const p of parts) {
      await tx.gapApproval.deleteMany({ where: { shiftId: p.shiftId, startsAt: { gte: p.startsAt }, endsAt: { lte: p.endsAt } } });
    }
    const ids: string[] = [];
    for (const p of parts) ids.push((await tx.gapApproval.create({ data: { ...p, enough }, select: { id: true } })).id);
    return ids;
  });
  for (const id of created) await audit(actor.id, "gap.approve", "GapApproval", id);
  revalidateStaffing([...eventIds][0]);
}

export async function unapproveGap(formData: FormData) {
  const actor = await requireUser("LEAD");
  const ids = z.array(z.cuid()).min(1).max(50).parse(formData.getAll("approvalId"));
  const approvals = await db.gapApproval.findMany({ where: { id: { in: ids } }, select: { id: true, shift: { select: { eventId: true } } } });
  const eventIds = new Set(approvals.map((a) => a.shift.eventId));
  if (eventIds.size !== 1) return;

  await db.gapApproval.deleteMany({ where: { id: { in: approvals.map((a) => a.id) } } });
  for (const a of approvals) await audit(actor.id, "gap.unapprove", "GapApproval", a.id);
  revalidateStaffing([...eventIds][0]);
}
