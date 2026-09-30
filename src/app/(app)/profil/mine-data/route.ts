import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

// GDPR art. 15 + 20: everything the portal holds about the logged-in user, as JSON.
export async function GET() {
  const user = await requireUser();

  const [profile, invitations, notes, actions] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { firstName: true, lastName: true, email: true, phone: true, role: true, status: true, createdAt: true, updatedAt: true },
    }),
    db.invitation.findMany({
      where: { userId: user.id },
      select: {
        status: true,
        note: true,
        respondedAt: true,
        createdAt: true,
        event: { select: { title: true, startsAt: true, endsAt: true, location: true } },
        availabilities: { select: { startsAt: true, endsAt: true, shift: { select: { kind: true, label: true } } } },
      },
    }),
    db.eventNote.findMany({
      where: { authorId: user.id },
      select: { body: true, createdAt: true, event: { select: { title: true, startsAt: true } } },
    }),
    db.auditLog.findMany({
      where: { actorId: user.id },
      select: { action: true, entity: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  await audit(user.id, "user.data_export", "User", user.id);

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      note: "Alle oplysninger, Bagscenen har registreret om dig. Adgangskoden gemmes kun som hash og er ikke medtaget.",
      profile,
      invitations,
      notes,
      actions,
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bagscenen-mine-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
