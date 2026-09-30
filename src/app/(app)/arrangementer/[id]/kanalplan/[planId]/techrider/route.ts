import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DEMO_DISABLED_MESSAGE, isDemo } from "@/lib/demo";
import { canEditPlans, canViewEvent } from "@/lib/events/access";
import { currentUser, type CurrentUser } from "@/lib/session";
import { TECHRIDER_MAX_BYTES, attachmentHeader, isPdf, sanitizeFilename } from "@/lib/techrider";

type Params = { params: Promise<{ id: string; planId: string }> };

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Loads the plan for the logged-in, approved user and checks they may see the event. */
async function load(params: Params["params"]) {
  const { id, planId } = await params;
  if (!z.cuid().safeParse(planId).success) return null;
  const user = await currentUser();
  if (!user || user.status !== "ACTIVE" || user.anonymizedAt) return null;
  const plan = await db.channelPlan.findUnique({
    where: { id: planId },
    select: { id: true, eventId: true, event: { select: { id: true, status: true, startsAt: true, endsAt: true } } },
  });
  if (!plan || plan.eventId !== id || !(await canViewEvent(user, id, plan.event.status))) return null;
  return { user, plan };
}

/** Browsers always send Origin on POST/DELETE from fetch; it must be our own site. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function editable(request: Request, params: Params["params"]): Promise<{ user: CurrentUser; planId: string; eventId: string } | Response> {
  if (!sameOrigin(request)) return json({ error: "Ikke tilladt" }, 403);
  const loaded = await load(params);
  if (!loaded || !(await canEditPlans(loaded.user, loaded.plan.event))) return json({ error: "Ikke tilladt" }, 403);
  return { user: loaded.user, planId: loaded.plan.id, eventId: loaded.plan.eventId };
}

// Download: logged-in people with access to the event only (never via the public QR link).
export async function GET(_request: Request, { params }: Params) {
  const loaded = await load(params);
  if (!loaded) return new Response("Not found", { status: 404 });
  const file = await db.techRider.findUnique({ where: { planId: loaded.plan.id } });
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      "Content-Disposition": attachmentHeader(file.filename),
      // The file is only ever a download, never rendered inside the app.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request, { params }: Params) {
  const ctx = await editable(request, params);
  if (ctx instanceof Response) return ctx;
  // The demo is public; don't let it host uploaded files.
  if (isDemo()) return json({ error: DEMO_DISABLED_MESSAGE }, 403);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > TECHRIDER_MAX_BYTES + 64 * 1024) return json({ error: "Filen er for stor (max 4 MB)." }, 413);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "Vælg en PDF-fil." }, 400);
  if (file.size > TECHRIDER_MAX_BYTES) return json({ error: "Filen er for stor (max 4 MB)." }, 413);

  const data = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(data)) return json({ error: "Filen er ikke en PDF." }, 415);

  const row = {
    filename: sanitizeFilename(file.name),
    size: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
    data,
    uploadedById: ctx.user.id,
  };
  await db.techRider.upsert({ where: { planId: ctx.planId }, create: { planId: ctx.planId, ...row }, update: { ...row, createdAt: new Date() } });
  await audit(ctx.user.id, "techrider.upload", "ChannelPlan", ctx.planId);
  revalidatePath(`/arrangementer/${ctx.eventId}/kanalplan/${ctx.planId}`);
  return json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const ctx = await editable(request, params);
  if (ctx instanceof Response) return ctx;
  await db.techRider.deleteMany({ where: { planId: ctx.planId } });
  await audit(ctx.user.id, "techrider.delete", "ChannelPlan", ctx.planId);
  revalidatePath(`/arrangementer/${ctx.eventId}/kanalplan/${ctx.planId}`);
  return json({ ok: true });
}
