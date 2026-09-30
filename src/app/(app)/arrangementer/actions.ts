"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { zonedTimeAfter, zonedToUtc } from "@/lib/datetime";
import { db } from "@/lib/db";
import { canViewEvent } from "@/lib/events/access";
import { isEventLocked, noteSchema, responseSchema } from "@/lib/events/response";
import { hasRole, requireUser } from "@/lib/session";

export type ActionResult = { ok?: boolean; error?: string };

function revalidateEvent(eventId: string) {
  revalidatePath(`/arrangementer/${eventId}`);
  revalidatePath(`/admin/arrangementer/${eventId}`);
  revalidatePath("/");
}

type InvitationWithEvent = Prisma.InvitationGetPayload<{ include: { event: { include: { shifts: true } } } }>;

/** Writes an answer (shifts / own time windows, or a decline) to an invitation. */
async function applyAnswer(invitation: InvitationWithEvent, input: unknown, actorId: string, action: string): Promise<ActionResult> {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ugyldigt svar" };
  const { status, shifts: picks, windows } = parsed.data;
  const event = invitation.event;
  if (isEventLocked(event)) return { error: "Arrangementet er afsluttet." };
  if (status === "ACCEPTED" && event.status === "CANCELLED") return { error: "Arrangementet er aflyst." };

  const shiftRows = [];
  for (const pick of picks) {
    const s = event.shifts.find((x) => x.id === pick.id);
    if (!s) return { error: "En af vagterne findes ikke længere. Genindlæs siden." };
    if (s.durationMinutes == null) {
      shiftRows.push({ shiftId: s.id, startsAt: s.startsAt, endsAt: s.endsAt });
    } else {
      // Duration shift: the helper chooses when to start; it lasts the given duration.
      if (!pick.date || !pick.start) return { error: "Vælg hvornår vagten starter." };
      const startsAt = zonedToUtc(pick.date, pick.start);
      shiftRows.push({ shiftId: s.id, startsAt, endsAt: new Date(startsAt.getTime() + s.durationMinutes * 60_000) });
    }
  }

  const rows =
    status === "DECLINED"
      ? []
      : [
          ...shiftRows,
          ...windows.map((w) => {
            const startsAt = zonedToUtc(w.date, w.start);
            return { shiftId: null, startsAt, endsAt: w.end ? zonedTimeAfter(w.date, w.end, startsAt) : null };
          }),
        ];

  await db.$transaction([
    db.availability.deleteMany({ where: { invitationId: invitation.id } }),
    db.availability.createMany({ data: rows.map((r) => ({ ...r, invitationId: invitation.id })) }),
    db.invitation.update({ where: { id: invitation.id }, data: { status, respondedAt: new Date() } }),
  ]);
  await audit(actorId, action, "Invitation", invitation.id);
  revalidateEvent(event.id);
  return { ok: true };
}

/**
 * A helper takes shifts on an event, or says they can't come ("Kan ikke deltage"). Every helper may
 * answer any published event that isn't over; the answer row is created on the first answer.
 * Once they have said yes, only the coordinator can change or cancel their shifts
 * (so nothing changes without the coordinator knowing).
 */
export async function respondToEvent(eventId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  z.cuid().parse(eventId);
  const event = await db.event.findUnique({ where: { id: eventId }, select: { status: true, startsAt: true, endsAt: true } });
  if (!event || event.status === "DRAFT") return { error: "Arrangementet findes ikke." };

  let invitation = await db.invitation.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    include: { event: { include: { shifts: true } } },
  });
  if (invitation?.status === "ACCEPTED") return { error: "Du er allerede på. Kontakt koordinatoren, hvis noget skal ændres." };
  if (!invitation) {
    if (event.status !== "PUBLISHED" || isEventLocked(event)) return { error: "Arrangementet tager ikke imod svar." };
    invitation = await db.invitation.upsert({
      where: { eventId_userId: { eventId, userId: user.id } },
      create: { eventId, userId: user.id },
      update: {},
      include: { event: { include: { shifts: true } } },
    });
  }
  const status = responseSchema.safeParse(input).data?.status;
  return applyAnswer(invitation, input, user.id, status === "DECLINED" ? "invitation.decline" : "invitation.accept");
}

/** Coordinator changes a helper's shifts or cancels them ("Ret vagter" / "Meld fra"). */
export async function setHelperAnswer(invitationId: string, input: unknown): Promise<ActionResult> {
  const actor = await requireUser("LEAD");
  z.cuid().parse(invitationId);
  const invitation = await db.invitation.findUnique({ where: { id: invitationId }, include: { event: { include: { shifts: true } } } });
  if (!invitation) return { error: "Invitationen findes ikke længere." };
  const status = responseSchema.safeParse(input).data?.status;
  return applyAnswer(invitation, input, actor.id, status === "DECLINED" ? "invitation.coordinator_decline" : "invitation.coordinator_update");
}

export async function addNote(eventId: string, body: string): Promise<ActionResult> {
  const user = await requireUser();
  z.cuid().parse(eventId);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const event = await db.event.findUnique({ where: { id: eventId }, select: { status: true, startsAt: true, endsAt: true } });
  if (!event || !(await canViewEvent(user, { id: eventId, ...event }))) return { error: "Ikke tilladt" };
  if (isEventLocked(event) && !hasRole(user.role, "LEAD")) return { error: "Arrangementet er afsluttet." };

  await db.eventNote.create({ data: { eventId, authorId: user.id, body: parsed.data } });
  revalidateEvent(eventId);
  return { ok: true };
}

/** Authors can delete their own notes; leads/admins can delete any. */
export async function deleteNote(noteId: string): Promise<ActionResult> {
  const user = await requireUser();
  z.cuid().parse(noteId);
  const note = await db.eventNote.findUnique({ where: { id: noteId } });
  if (!note) return { ok: true };
  if (note.authorId !== user.id && !hasRole(user.role, "LEAD")) return { error: "Ikke tilladt" };

  await db.eventNote.delete({ where: { id: noteId } });
  revalidateEvent(note.eventId);
  return { ok: true };
}
