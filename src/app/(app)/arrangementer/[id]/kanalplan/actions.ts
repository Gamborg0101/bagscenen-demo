"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Channel } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { planSaveSchema, rowsToDb } from "@/lib/channel-plan";
import { db } from "@/lib/db";
import { canEditPlans, canViewEvent } from "@/lib/events/access";
import { requireUser } from "@/lib/session";

const SHARE_HOURS = 8;

export type PlanActionResult = { ok?: boolean; error?: string; version?: string };

/** Loads a plan's event and checks the current user may edit it. */
async function editablePlan(planId: string) {
  const user = await requireUser();
  z.cuid().parse(planId);
  const plan = await db.channelPlan.findUnique({
    where: { id: planId },
    include: { event: { select: { id: true, status: true, startsAt: true, endsAt: true } } },
  });
  if (!plan || !(await canViewEvent(user, plan.eventId, plan.event.status)) || !(await canEditPlans(user, plan.event))) {
    return { user, plan: null };
  }
  return { user, plan };
}

const createSchema = z.object({
  eventId: z.cuid(),
  kind: z.enum(["EVENT", "BAND"]),
  name: z.string().trim().max(120),
  mixer: z.enum(["SQ7", "SQ5", "MACKIE"]),
  copyFrom: z.union([z.cuid(), z.literal("")]).optional(),
});

export async function createPlan(_prev: PlanActionResult, formData: FormData): Promise<PlanActionResult> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Udfyld felterne." };
  const { eventId, kind, copyFrom } = parsed.data;
  let { mixer } = parsed.data;

  // Copying: the source must be a plan the user may see; channels and mixer come along (no techrider, no sharing).
  let channels: Omit<Channel, "id" | "planId">[] = [];
  let sourceName = "";
  if (copyFrom) {
    const source = await db.channelPlan.findUnique({
      where: { id: copyFrom },
      include: { channels: true, event: { select: { status: true } } },
    });
    if (!source || !(await canViewEvent(user, source.eventId, source.event.status))) return { error: "Planen kan ikke kopieres." };
    mixer = source.mixer;
    sourceName = source.kind === "BAND" ? source.name : "";
    channels = source.channels.map(({ id: _id, planId: _planId, ...c }) => c); // eslint-disable-line @typescript-eslint/no-unused-vars
  }

  const name = kind === "EVENT" ? "Arrangementet" : parsed.data.name || sourceName;
  if (!name) return { error: "Skriv bandets navn." };

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, status: true, startsAt: true, endsAt: true } });
  if (!event || !(await canViewEvent(user, eventId, event.status)) || !(await canEditPlans(user, event))) return { error: "Ikke tilladt" };
  if (kind === "EVENT" && (await db.channelPlan.count({ where: { eventId, kind: "EVENT" } })) > 0) {
    return { error: "Arrangementet har allerede en kanalplan." };
  }

  const count = await db.channelPlan.count({ where: { eventId } });
  const plan = await db.channelPlan.create({
    data: { eventId, kind, name, mixer, sortKey: kind === "EVENT" ? 0 : count + 1, channels: { create: channels } },
  });
  await audit(user.id, "plan.create", "ChannelPlan", plan.id);
  redirect(`/arrangementer/${eventId}/kanalplan/${plan.id}/rediger`);
}

export async function savePlan(planId: string, input: unknown): Promise<PlanActionResult> {
  const { user, plan } = await editablePlan(planId);
  if (!plan) return { error: "Ikke tilladt" };

  const parsed = planSaveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ugyldig kanalplan" };
  const { name, mixer, channels, version } = parsed.data;

  // Someone else saved since this editor was opened: don't overwrite their work.
  if (version && version !== plan.updatedAt.toISOString()) {
    return { error: "Planen er blevet ændret af en anden, mens du redigerede. Genindlæs siden og prøv igen." };
  }

  const rows = rowsToDb(channels);
  const [, , updated] = await db.$transaction([
    db.channel.deleteMany({ where: { planId } }),
    db.channel.createMany({ data: rows.map((r) => ({ ...r, planId })) }),
    db.channelPlan.update({ where: { id: planId }, data: { name: plan.kind === "EVENT" ? plan.name : name, mixer } }),
  ]);
  await audit(user.id, "plan.update", "ChannelPlan", planId);
  revalidatePath(`/arrangementer/${plan.eventId}`);
  revalidatePath(`/arrangementer/${plan.eventId}/kanalplan/${planId}`);
  return { ok: true, version: updated.updatedAt.toISOString() };
}

export async function deletePlan(planId: string): Promise<PlanActionResult> {
  const { user, plan } = await editablePlan(planId);
  if (!plan) return { error: "Ikke tilladt" };
  await db.channelPlan.delete({ where: { id: planId } });
  await audit(user.id, "plan.delete", "ChannelPlan", planId);
  redirect(`/arrangementer/${plan.eventId}`);
}

/** Turns the public read-only link on, off, or replaces it with a new one. */
export async function setPlanShare(formData: FormData) {
  const planId = String(formData.get("planId") ?? "");
  const mode = z.enum(["on", "off", "new"]).parse(formData.get("mode"));
  const { user, plan } = await editablePlan(planId);
  if (!plan) return;
  // Links always expire 8 hours after they are made; a new link invalidates the old one.
  const expires = new Date(Date.now() + SHARE_HOURS * 3600_000);
  await db.channelPlan.update({
    where: { id: planId },
    data:
      mode === "off"
        ? { shareEnabled: false, shareExpiresAt: null, shareVersion: { increment: 1 } }
        : { shareEnabled: true, shareExpiresAt: expires, shareVersion: { increment: 1 } },
  });
  await audit(user.id, `plan.share.${mode}`, "ChannelPlan", planId);
  revalidatePath(`/arrangementer/${plan.eventId}/kanalplan/${planId}`);
}
