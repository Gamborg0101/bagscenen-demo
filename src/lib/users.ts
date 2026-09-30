import "server-only";
import { db } from "@/lib/db";

/**
 * GDPR deletion: removes all personal data but keeps the row so past events
 * still make sense ("Tidligere medhjælper"). Upcoming invitations are dropped
 * so the coverage shows the gap.
 */
export async function anonymizeUser(userId: string) {
  const lockedBefore = new Date(Date.now() - 12 * 3600_000);
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        firstName: "Slettet",
        lastName: "bruger",
        email: `slettet-${userId}@invalid.local`,
        phone: "",
        passwordHash: "!", // not a valid argon2 hash, so no password can match
        status: "DISABLED",
        disabledAt: new Date(),
        anonymizedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    }),
    db.passwordResetToken.deleteMany({ where: { userId } }),
    db.invitation.deleteMany({
      where: {
        userId,
        event: { OR: [{ endsAt: { gte: lockedBefore } }, { endsAt: null, startsAt: { gte: lockedBefore } }] },
      },
    }),
  ]);
}

/** True if removing this user would leave no active admin. */
export async function isLastAdmin(userId: string): Promise<boolean> {
  const others = await db.user.count({
    where: { role: "ADMIN", status: "ACTIVE", anonymizedAt: null, id: { not: userId } },
  });
  return others === 0;
}
