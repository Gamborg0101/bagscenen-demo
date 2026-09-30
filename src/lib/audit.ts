import "server-only";
import { db } from "@/lib/db";

/** Records who did what. Never put personal data in `action`/`entity`. */
export async function audit(actorId: string | null, action: string, entity: string, entityId?: string) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId } });
}
