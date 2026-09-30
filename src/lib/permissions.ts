import type { Role } from "@prisma/client";

type Actor = { id: string; role: Role };
type Target = { id: string; role: Role };

/** LEADs may only manage helpers; ADMINs may manage anyone except themselves. */
export function canManageUser(actor: Actor, target: Target): boolean {
  if (actor.id === target.id) return false;
  if (actor.role === "ADMIN") return true;
  return actor.role === "LEAD" && target.role === "HELPER";
}
