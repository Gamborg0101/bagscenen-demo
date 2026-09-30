"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { eventFormSchema, formToDb } from "@/lib/events/form";
import { requireUser } from "@/lib/session";

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
    const created = await db.event.create({
      data: {
        ...event,
        createdBy: { connect: { id: actor.id } },
        contacts: { create: contacts },
        shifts: { create: shifts.map(({ id: _, ...s }) => s) }, // eslint-disable-line @typescript-eslint/no-unused-vars
      },
      select: { id: true },
    });
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
    await db.$transaction([
      db.event.update({ where: { id: eventId }, data: event }),
      db.eventContact.deleteMany({ where: { eventId } }),
      db.eventContact.createMany({ data: contacts.map((c) => ({ ...c, eventId })) }),
      // Shifts keep their ids so helpers' sign-ups stay attached.
      db.shift.deleteMany({ where: { eventId, id: { notIn: keptIds } } }),
      ...shifts.map(({ id: sid, ...s }) =>
        sid && existingShiftIds.has(sid)
          ? db.shift.update({ where: { id: sid }, data: s })
          : db.shift.create({ data: { ...s, eventId } }),
      ),
    ]);
    await audit(actor.id, "event.update", "Event", eventId);
  }

  revalidatePath("/admin/arrangementer");
  revalidatePath(`/admin/arrangementer/${id}`);
  return { id };
}

/** Only drafts can be deleted; everything else is kept for future reference. */
export async function deleteDraft(formData: FormData) {
  const actor = await requireUser("LEAD");
  const id = z.cuid().parse(formData.get("eventId"));
  const { count } = await db.event.deleteMany({ where: { id, status: "DRAFT" } });
  if (count) await audit(actor.id, "event.delete", "Event", id);
  revalidatePath("/admin/arrangementer");
  redirect("/admin/arrangementer");
}

// ---------- Invitations ----------

export async function inviteHelpers(eventId: string, userIds: string[]): Promise<{ error?: string; count?: number }> {
  const actor = await requireUser("LEAD");
  z.cuid().parse(eventId);
  const ids = z.array(z.cuid()).max(200).parse(userIds);

  const event = await db.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event) return { error: "Arrangementet findes ikke." };
  if (event.status !== "PUBLISHED") return { error: "Sæt arrangementet til “Klar”, før du inviterer." };

  // Only active, non-anonymised users can be invited.
  const users = await db.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE", anonymizedAt: null },
    select: { id: true },
  });
  const { count } = await db.invitation.createMany({
    data: users.map((u) => ({ eventId, userId: u.id })),
    skipDuplicates: true,
  });
  await audit(actor.id, "invitation.create", "Event", eventId);
  revalidatePath(`/admin/arrangementer/${eventId}`);
  return { count };
}

export async function removeInvitation(formData: FormData) {
  const actor = await requireUser("LEAD");
  const id = z.cuid().parse(formData.get("invitationId"));
  const inv = await db.invitation.delete({ where: { id }, select: { eventId: true } }).catch(() => null);
  if (!inv) return;
  await audit(actor.id, "invitation.remove", "Invitation", id);
  revalidatePath(`/admin/arrangementer/${inv.eventId}`);
}

