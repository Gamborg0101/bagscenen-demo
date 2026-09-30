import "server-only";
import { db } from "@/lib/db";
import { anonymizeUser } from "@/lib/users";

// Retention periods — keep in sync with docs/gdpr/sletningspolitik.md and the privacy page.
export const RETENTION = {
  pendingSignupDays: 30, // signups never approved
  disabledUserDays: 365, // deactivated accounts are anonymised after this
  eventPersonalDataDays: 365, // organiser contacts, notes, helper comments and techriders after the event
  openRequestGraceDays: 7, // unused booking links after they expire
  requestDays: 180, // submitted booking forms that were never turned into an event
  auditLogDays: 365,
  tokenDays: 7, // used/expired reset tokens
} as const;

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

/** Deletes or anonymises personal data that is past its retention period. Idempotent. */
export async function runRetention() {
  const r = RETENTION;

  const pendingSignups = await db.user.deleteMany({
    where: { status: "PENDING", createdAt: { lt: daysAgo(r.pendingSignupDays) } },
  });

  const staleUsers = await db.user.findMany({
    where: { status: "DISABLED", anonymizedAt: null, disabledAt: { lt: daysAgo(r.disabledUserDays) } },
    select: { id: true },
  });
  for (const u of staleUsers) await anonymizeUser(u.id);

  // Events are kept for reference, but the personal data around them is not.
  const oldEvents = { OR: [{ endsAt: { lt: daysAgo(r.eventPersonalDataDays) } }, { endsAt: null, startsAt: { lt: daysAgo(r.eventPersonalDataDays) } }] };
  const contacts = await db.eventContact.deleteMany({ where: { event: oldEvents } });
  const notes = await db.eventNote.deleteMany({ where: { event: oldEvents } });
  const techRiders = await db.techRider.deleteMany({ where: { plan: { event: oldEvents } } });
  const helperComments = await db.invitation.updateMany({ where: { event: oldEvents, note: { not: null } }, data: { note: null } });

  const requests = await db.eventRequest.deleteMany({
    where: {
      OR: [
        { status: "OPEN", expiresAt: { lt: daysAgo(r.openRequestGraceDays) } },
        { status: { in: ["SUBMITTED", "ARCHIVED"] }, createdAt: { lt: daysAgo(r.requestDays) } },
      ],
    },
  });

  const audit = await db.auditLog.deleteMany({ where: { createdAt: { lt: daysAgo(r.auditLogDays) } } });
  const resetTokens = await db.passwordResetToken.deleteMany({
    where: { OR: [{ usedAt: { lt: daysAgo(r.tokenDays) } }, { expiresAt: { lt: daysAgo(r.tokenDays) } }] },
  });
  const attempts = await db.authAttempt.deleteMany({ where: { createdAt: { lt: daysAgo(1) } } });

  return {
    pendingSignups: pendingSignups.count,
    anonymisedUsers: staleUsers.length,
    eventContacts: contacts.count,
    eventNotes: notes.count,
    techRiders: techRiders.count,
    helperComments: helperComments.count,
    requests: requests.count,
    auditLog: audit.count,
    resetTokens: resetTokens.count,
    authAttempts: attempts.count,
  };
}
