"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { runRetention } from "@/lib/retention";
import { requireUser } from "@/lib/session";

export type RetentionState = { summary?: string };

export async function runRetentionNow(): Promise<RetentionState> {
  const actor = await requireUser("ADMIN");
  const r = await runRetention();
  await audit(actor.id, "retention.run", "System");
  revalidatePath("/admin/log");
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  return { summary: total === 0 ? "Intet at rydde op." : `Ryddet op: ${total} poster.` };
}
