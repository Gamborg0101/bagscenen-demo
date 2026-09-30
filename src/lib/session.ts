import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const ROLE_RANK: Record<Role, number> = { HELPER: 0, LEAD: 1, ADMIN: 2 };

export function hasRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/** Current user from the DB (not just the JWT), or null. Cached per request. */
export const currentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      anonymizedAt: true,
      sessionVersion: true,
    },
  });
  // A password change/reset bumps the version, which invalidates older sessions.
  if (!user || user.sessionVersion !== (session?.sv ?? 0)) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/**
 * Guard for pages and Server Actions. Redirects if not logged in, not approved,
 * disabled, or below the required role.
 */
export async function requireUser(minRole: Role = "HELPER"): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user || user.anonymizedAt || user.status === "DISABLED") redirect("/login");
  if (user.status === "PENDING") redirect("/afventer");
  if (!hasRole(user.role, minRole)) redirect("/");
  return user;
}
