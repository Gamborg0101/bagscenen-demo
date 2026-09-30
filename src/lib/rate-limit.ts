import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

type Rule = { key: string; limit: number; windowMs: number };

/**
 * Records one attempt for every key and returns false if any key is over its limit.
 * Emails are hashed so the table holds no personal data.
 */
export async function checkRateLimit(rules: Rule[]): Promise<boolean> {
  const now = Date.now();
  let allowed = true;
  for (const rule of rules) {
    const since = new Date(now - rule.windowMs);
    const count = await db.authAttempt.count({
      where: { key: rule.key, createdAt: { gte: since } },
    });
    if (count >= rule.limit) allowed = false;
  }
  await db.authAttempt.createMany({ data: rules.map((r) => ({ key: r.key })) });

  // Opportunistic cleanup of old rows.
  if (Math.random() < 0.05) {
    await db.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 3600_000) } } });
  }
  return allowed;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Prefer headers set by the hosting proxy (Vercel), which clients cannot spoof.
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export const rateKey = (action: string, value: string) => `${action}:${hashToken(value)}`;

const FIFTEEN_MIN = 15 * 60_000;
const HOUR = 60 * 60_000;

export async function loginAllowed(email: string): Promise<boolean> {
  const ip = await clientIp();
  return checkRateLimit([
    { key: rateKey("login-email", email), limit: 10, windowMs: FIFTEEN_MIN },
    { key: rateKey("login-ip", ip), limit: 50, windowMs: FIFTEEN_MIN },
  ]);
}

/** Demo logins share one account, so they are limited per IP only. */
export async function demoLoginAllowed(): Promise<boolean> {
  const ip = await clientIp();
  return checkRateLimit([{ key: rateKey("demo-ip", ip), limit: 30, windowMs: FIFTEEN_MIN }]);
}

export async function signupAllowed(): Promise<boolean> {
  const ip = await clientIp();
  return checkRateLimit([{ key: rateKey("signup-ip", ip), limit: 10, windowMs: HOUR }]);
}

export async function resetAllowed(): Promise<boolean> {
  const ip = await clientIp();
  return checkRateLimit([{ key: rateKey("reset-ip", ip), limit: 20, windowMs: HOUR }]);
}
