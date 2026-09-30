import { formatStamp } from "@/lib/datetime";
import { db } from "@/lib/db";
import { displayName } from "@/lib/events/view";
import { RETENTION } from "@/lib/retention";
import { requireUser } from "@/lib/session";
import { RetentionButton } from "./retention-button";

export const metadata = { title: "Log · Bagscenen" };

const ACTION_LABEL: Record<string, string> = {
  "user.signup": "Oprettede konto",
  "user.bootstrap_admin": "Blev første admin",
  "user.login": "Loggede ind",
  "user.approve": "Godkendte bruger",
  "user.reject": "Afviste tilmelding",
  "user.disable": "Deaktiverede bruger",
  "user.enable": "Genaktiverede bruger",
  "user.erase": "Slettede brugerdata",
  "user.self_delete": "Slettede egen konto",
  "user.reset_link": "Oprettede nulstillingslink",
  "user.password_reset": "Nulstillede adgangskode",
  "user.password_change": "Skiftede adgangskode",
  "user.profile_update": "Opdaterede profil",
  "user.data_export": "Hentede egne data",
  "user.role.admin": "Gjorde til admin",
  "user.role.lead": "Gjorde til tovholder",
  "user.role.helper": "Gjorde til medhjælper",
  "event.create": "Oprettede arrangement",
  "event.update": "Redigerede arrangement",
  "event.delete": "Slettede kladde",
  "invitation.create": "Inviterede medhjælpere",
  "invitation.remove": "Fjernede invitation",
  "invitation.accept": "Sagde ja",
  "invitation.decline": "Meldte fra",
  "invitation.coordinator_update": "Rettede en medhjælpers vagter",
  "invitation.coordinator_decline": "Meldte en medhjælper fra",
  "request.create": "Oprettede bestillingslink",
  "request.submit": "Arrangør sendte bestilling",
  "request.convert": "Oprettede arrangement fra bestilling",
  "request.archive": "Arkiverede bestilling",
  "plan.create": "Oprettede kanalplan",
  "plan.update": "Gemte kanalplan",
  "plan.delete": "Slettede kanalplan",
  "plan.share.on": "Delte kanalplan (QR)",
  "plan.share.new": "Lavede nyt kanalplan-link",
  "plan.share.off": "Slog deling af kanalplan fra",
  "techrider.upload": "Uploadede techrider",
  "techrider.delete": "Fjernede techrider",
  "retention.run": "Automatisk oprydning",
};

export default async function AuditLogPage() {
  await requireUser("ADMIN");
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { firstName: true, lastName: true, anonymizedAt: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Log</h1>
        <p className="text-xs text-muted">
          Hvem har gjort hvad. Gemmes i {RETENTION.auditLogDays} dage. Indeholder ingen personoplysninger ud over hvem, der
          handlede.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Oprydning</h2>
        <p className="text-xs text-muted">
          Kører automatisk hver nat: sletter ikke-godkendte tilmeldinger efter {RETENTION.pendingSignupDays} dage,
          anonymiserer deaktiverede brugere efter {RETENTION.disabledUserDays} dage, og fjerner kontaktpersoner og noter{" "}
          {RETENTION.eventPersonalDataDays} dage efter et arrangement.
        </p>
        <RetentionButton />
      </section>

      <ul className="divide-y divide-line border-y border-line">
        {entries.map((e) => (
          <li key={e.id} className="flex gap-3 py-2 text-xs">
            <span className="w-28 shrink-0 text-muted tabular-nums">{formatStamp(e.createdAt)}</span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{e.actorId ? displayName(e.actor) : "System"}</span>{" "}
              <span className="text-muted">{ACTION_LABEL[e.action] ?? e.action}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
