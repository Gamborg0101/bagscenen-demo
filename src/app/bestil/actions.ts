"use server";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { intakeSchema } from "@/lib/events/intake";
import { checkRateLimit, clientIp, rateKey } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";

export type IntakeResult = { ok?: boolean; error?: "invalid" | "required" | "error"; fields?: string[] };

/** Public: an organiser submits the booking form behind a one-time link. */
export async function submitIntake(token: string, input: unknown, honeypot: string): Promise<IntakeResult> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { error: "invalid" };

  const ip = await clientIp();
  if (!(await checkRateLimit([{ key: rateKey("intake-ip", ip), limit: 10, windowMs: 3600_000 }]))) {
    return { error: "error" };
  }

  const request = await db.eventRequest.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!request || request.status !== "OPEN" || request.expiresAt < new Date()) return { error: "invalid" };

  // Bots fill every field; people never see this one. Pretend success, store nothing.
  if (honeypot) return { ok: true };

  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "required", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  }

  // Single use: only flips OPEN → SUBMITTED once, even with concurrent submits.
  const { count } = await db.eventRequest.updateMany({
    where: { id: request.id, status: "OPEN" },
    data: { status: "SUBMITTED", submittedAt: new Date(), data: parsed.data },
  });
  if (count === 0) return { error: "invalid" };
  await audit(null, "request.submit", "EventRequest", request.id);
  return { ok: true };
}
