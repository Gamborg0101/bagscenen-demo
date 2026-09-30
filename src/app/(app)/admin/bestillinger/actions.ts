"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import { requireUser } from "@/lib/session";
import { generateToken, hashToken } from "@/lib/tokens";

const LINK_TTL_DAYS = 30;

export type RequestLinkState = { url?: string; error?: string };

/** One-time booking link for an organiser. Only the hash is stored, so the link is shown once. */
export async function createRequestLink(_prev: RequestLinkState, formData: FormData): Promise<RequestLinkState> {
  const actor = await requireUser("LEAD");
  const label = z.string().trim().min(1).max(200).safeParse(formData.get("label"));
  if (!label.success) return { error: "Skriv hvem linket er til." };

  const token = generateToken();
  const request = await db.eventRequest.create({
    data: {
      tokenHash: hashToken(token),
      label: label.data,
      createdById: actor.id,
      expiresAt: new Date(Date.now() + LINK_TTL_DAYS * 86_400_000),
    },
  });
  await audit(actor.id, "request.create", "EventRequest", request.id);
  revalidatePath("/admin/bestillinger");

  return { url: `${await appUrl()}/bestil/${token}` };
}

/** Closes an unused link or sets aside a submitted request. */
export async function archiveRequest(formData: FormData) {
  const actor = await requireUser("LEAD");
  const id = z.cuid().parse(formData.get("requestId"));
  await db.eventRequest.updateMany({
    where: { id, status: { in: ["OPEN", "SUBMITTED"] } },
    data: { status: "ARCHIVED" },
  });
  await audit(actor.id, "request.archive", "EventRequest", id);
  revalidatePath("/admin/bestillinger");
}
