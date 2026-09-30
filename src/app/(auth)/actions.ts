"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { DEMO_DISABLED_MESSAGE, isDemo } from "@/lib/demo";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { resetAllowed, signupAllowed } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";
import { resetPasswordSchema, signupSchema } from "@/lib/validation/user";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

// Echo back non-secret values so the form keeps them after an error.
function keep(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

/** Only same-site relative paths, e.g. "/profil" — never "//evil.com". */
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return /^\/(?![/\\])[\w\-/%.?=&]{0,300}$/.test(v) ? v : "/";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keep(formData, ["email"]);
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeNext(formData.get("next")),
    });
  } catch (e) {
    if (e instanceof CredentialsSignin && e.code === "rate_limited") {
      return { error: "For mange forsøg. Vent 15 minutter og prøv igen.", values };
    }
    if (e instanceof AuthError) {
      return { error: "Forkert e-mail eller adgangskode.", values };
    }
    throw e; // redirect on success
  }
  return {};
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keep(formData, ["firstName", "lastName", "email", "phone"]);
  if (isDemo()) return { error: DEMO_DISABLED_MESSAGE, values };

  if (!(await signupAllowed())) {
    return { error: "For mange forsøg. Prøv igen senere.", values };
  }

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { firstName, lastName, email, phone, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: "Kontoen kunne ikke oprettes. Har du allerede en konto, så log ind.", values };
  }

  const user = await db.user.create({
    data: { firstName, lastName, email, phone, passwordHash: await hashPassword(password) },
    select: { id: true },
  });
  await audit(user.id, "user.signup", "User", user.id);

  // First admin on a fresh install: only while there is no admin at all, and only for the
  // exact email in BOOTSTRAP_ADMIN_EMAIL (set on the server; remove it afterwards).
  const bootstrap = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (bootstrap && bootstrap === email && (await db.user.count({ where: { role: "ADMIN", anonymizedAt: null } })) === 0) {
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN", status: "ACTIVE" } });
    await audit(user.id, "user.bootstrap_admin", "User", user.id);
    await signIn("credentials", { email, password, redirectTo: "/" });
    return {};
  }

  // Log in straight away; the pending screen explains that approval is needed.
  await signIn("credentials", { email, password, redirectTo: "/afventer" });
  return {};
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isDemo()) return { error: DEMO_DISABLED_MESSAGE };
  if (!(await resetAllowed())) return { error: "For mange forsøg. Prøv igen senere." };

  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { token, password } = parsed.data;

  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Linket er ugyldigt eller udløbet. Bed din koordinator om et nyt." };
  }

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
    }),
    // Consume this token and any other outstanding ones for the user.
    db.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  await audit(record.userId, "user.password_reset", "User", record.userId);

  redirect("/login?nulstillet=1");
}

/** Demo mode: sign in as the shared coordinator or helper account with one click. */
export async function demoLoginAction(formData: FormData) {
  if (!isDemo()) redirect("/login");
  try {
    await signIn("demo", { role: formData.get("role"), redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/login?demo=fejl");
    throw e; // redirect on success
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
