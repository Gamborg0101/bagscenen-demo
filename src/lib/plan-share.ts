import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Public, read-only share links for channel plans. The key is derived from the plan id and a
// version with an HMAC over AUTH_SECRET, so nothing secret is stored in the database and
// bumping the version (or switching sharing off) makes old links stop working.

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing");
  return s;
}

function mac(planId: string, version: number): string {
  return createHmac("sha256", secret()).update(`channel-plan:${planId}:${version}`).digest("base64url");
}

/** "planId.mac" — used in /kanalplan/<key>. */
export function planShareKey(planId: string, version: number): string {
  return `${planId}.${mac(planId, version)}`;
}

/** Splits and checks a key; returns the plan id when the MAC matches the given version. */
export function parsePlanShareKey(key: string): { planId: string; matches: (version: number) => boolean } | null {
  const m = key.match(/^([a-z0-9]{20,40})\.([A-Za-z0-9_-]{43})$/);
  if (!m) return null;
  const [, planId, given] = m;
  return {
    planId,
    matches: (version) => {
      const a = Buffer.from(mac(planId, version));
      const b = Buffer.from(given);
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}
