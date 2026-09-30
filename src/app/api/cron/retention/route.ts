import { timingSafeEqual } from "node:crypto";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { resetDemoData } from "@/lib/demo-seed";
import { runRetention } from "@/lib/retention";

// Called daily by Vercel Cron (see vercel.json) with "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    !!secret &&
    secret.length >= 32 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  // The public demo starts over with fresh sample data every night instead.
  if (isDemo()) {
    await resetDemoData(db);
    return Response.json({ demoReset: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await runRetention();
  await audit(null, "retention.run", "System");
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
