import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

type PlanContent = {
  name: string;
  mixer: string;
  channels: { number: number; source: string; gear: string | null; di: string; phantom: boolean; inputSource: string | null; inputNumber: number | null; note: string | null }[];
};

/**
 * Fingerprint of what the public page shows. Stored when a share link is made, so the page can
 * say "Kanalplanen er ændret" instead of showing a plan that no longer matches the QR code.
 */
export function planContentHash(plan: PlanContent): string {
  const channels = [...plan.channels]
    .sort((a, b) => a.number - b.number)
    .map((c) => [c.number, c.source, c.gear, c.di, c.phantom, c.inputSource, c.inputNumber, c.note]);
  return createHash("sha256").update(JSON.stringify([plan.name, plan.mixer, channels])).digest("base64url");
}
