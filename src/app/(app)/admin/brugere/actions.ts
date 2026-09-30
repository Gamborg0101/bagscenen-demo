"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import { canManageUser } from "@/lib/permissions";
import { requireUser, type CurrentUser } from "@/lib/session";
import { generateToken, hashToken } from "@/lib/tokens";
import { anonymizeUser } from "@/lib/users";
import { isDemoAccount } from "@/lib/demo";

const RESET_TTL_MS = 24 * 60 * 60 * 1000;
const idSchema = z.cuid();

async function loadTarget(actor: CurrentUser, rawId: unknown) {
  const id = idSchema.parse(rawId);
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.anonymizedAt || !canManageUser(actor, target)) {
    throw new Error("Ikke tilladt");
  }
  return target;
}

export async function approveUser(formData: FormData) {
  const actor = await requireUser("LEAD");
  const target = await loadTarget(actor, formData.get("userId"));
  if (target.status !== "PENDING") return;
  await db.user.update({ where: { id: target.id }, data: { status: "ACTIVE" } });
  await audit(actor.id, "user.approve", "User", target.id);
  revalidatePath("/admin/brugere");
}

/** Rejecting a pending signup deletes it entirely — no reason to keep the data. */
export async function rejectUser(formData: FormData) {
  const actor = await requireUser("LEAD");
  const target = await loadTarget(actor, formData.get("userId"));
  if (isDemoAccount(target.id)) return;
  if (target.status !== "PENDING") return;
  await db.user.delete({ where: { id: target.id } });
  await audit(actor.id, "user.reject", "User", target.id);
  revalidatePath("/admin/brugere");
}

export async function setUserStatus(formData: FormData) {
  const actor = await requireUser("LEAD");
  const target = await loadTarget(actor, formData.get("userId"));
  if (isDemoAccount(target.id)) return;
  const status = z.enum(["ACTIVE", "DISABLED"]).parse(formData.get("status"));
  if (target.status === "PENDING") return;
  await db.user.update({
    where: { id: target.id },
    data: status === "DISABLED" ? { status, disabledAt: new Date(), sessionVersion: { increment: 1 } } : { status, disabledAt: null },
  });
  await audit(actor.id, status === "DISABLED" ? "user.disable" : "user.enable", "User", target.id);
  revalidatePath("/admin/brugere");
}

export async function setUserRole(formData: FormData) {
  const actor = await requireUser("ADMIN");
  const target = await loadTarget(actor, formData.get("userId"));
  if (isDemoAccount(target.id)) return;
  const role: Role = z.enum(["ADMIN", "LEAD", "HELPER"]).parse(formData.get("role"));
  await db.user.update({ where: { id: target.id }, data: { role } });
  await audit(actor.id, `user.role.${role.toLowerCase()}`, "User", target.id);
  revalidatePath("/admin/brugere");
}

export type ResetLinkState = { url?: string; error?: string };

export async function createResetLink(_prev: ResetLinkState, formData: FormData): Promise<ResetLinkState> {
  const actor = await requireUser("LEAD");
  let target;
  try {
    target = await loadTarget(actor, formData.get("userId"));
  } catch {
    return { error: "Ikke tilladt" };
  }

  const token = generateToken();
  await db.$transaction([
    // Only the newest link works.
    db.passwordResetToken.updateMany({
      where: { userId: target.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: { userId: target.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);
  await audit(actor.id, "user.reset_link", "User", target.id);

  return { url: `${await appUrl()}/nulstil/${token}` };
}

/** ADMIN only: permanently removes the personal data of a deactivated user. */
export async function eraseUser(formData: FormData) {
  const actor = await requireUser("ADMIN");
  const target = await loadTarget(actor, formData.get("userId"));
  if (isDemoAccount(target.id)) return;
  if (target.status !== "DISABLED") return;
  await anonymizeUser(target.id);
  await audit(actor.id, "user.erase", "User", target.id);
  revalidatePath("/admin/brugere");
}
