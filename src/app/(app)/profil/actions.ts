"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";
import { anonymizeUser, isLastAdmin } from "@/lib/users";
import { checkRateLimit, rateKey } from "@/lib/rate-limit";
import { normalizePhone, passwordContainsPersonalInfo, passwordSchema } from "@/lib/validation/user";
import { DEMO_DISABLED_MESSAGE, isDemo } from "@/lib/demo";

export type ProfileState = { ok?: string; error?: string; fieldErrors?: Record<string, string[] | undefined> };

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Skal udfyldes").max(80),
  lastName: z.string().trim().min(1, "Skal udfyldes").max(80),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((p) => /^\+?\d{8,15}$/.test(p), "Ugyldigt telefonnummer"),
});

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  await audit(user.id, "user.profile_update", "User", user.id);
  revalidatePath("/profil");
  return { ok: "Gemt." };
}

const passwordChangeSchema = z
  .object({ current: z.string().min(1, "Skal udfyldes").max(200), password: passwordSchema, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, { path: ["passwordConfirm"], message: "Adgangskoderne er ikke ens" });

export async function changePassword(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  if (isDemo()) return { error: DEMO_DISABLED_MESSAGE };
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  if (passwordContainsPersonalInfo(parsed.data.password, [user.email, user.firstName, user.lastName])) {
    return { fieldErrors: { password: ["Adgangskoden må ikke indeholde dit navn eller din mail"] } };
  }
  // Stops guessing the current password from a hijacked session.
  if (!(await checkRateLimit([{ key: rateKey("pwchange", user.id), limit: 5, windowMs: 15 * 60_000 }]))) {
    return { error: "For mange forsøg. Vent 15 minutter." };
  }

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(row.passwordHash, parsed.data.current))) {
    return { fieldErrors: { current: ["Forkert adgangskode"] } };
  }
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password), sessionVersion: { increment: 1 } },
  });
  await audit(user.id, "user.password_change", "User", user.id);
  // All sessions (including this one) are now invalid; log in again with the new password.
  await signOut({ redirectTo: "/login?nulstillet=1" });
  return {};
}

export async function deleteOwnAccount(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  if (isDemo()) return { error: DEMO_DISABLED_MESSAGE };
  if (formData.get("confirm") !== "SLET") return { error: "Skriv SLET for at bekræfte." };
  if (user.role === "ADMIN" && (await isLastAdmin(user.id))) {
    return { error: "Du er den eneste admin. Gør en anden til admin først." };
  }
  await anonymizeUser(user.id);
  await audit(user.id, "user.self_delete", "User", user.id);
  await signOut({ redirectTo: "/login" });
  return {};
}
