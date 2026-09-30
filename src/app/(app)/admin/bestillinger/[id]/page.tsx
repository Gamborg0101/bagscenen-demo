import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { buttonClass } from "@/components/styles";
import { formatDay, formatStamp } from "@/lib/datetime";
import { db } from "@/lib/db";
import { intakeSchema } from "@/lib/events/intake";
import { EVENT_TYPE_LABEL, LIGHTING_LABEL } from "@/lib/events/labels";
import { requireUser } from "@/lib/session";
import { archiveRequest } from "../actions";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("LEAD");
  const { id } = await params;
  if (!z.cuid().safeParse(id).success) notFound();
  const request = await db.eventRequest.findUnique({ where: { id } });
  if (!request) notFound();

  const parsed = intakeSchema.safeParse(request.data);
  const d = parsed.success ? parsed.data : null;

  const rows: [string, string | null | false][] = d
    ? [
        ["Kontakt", [d.contactName, d.contactEmail, d.contactPhone].filter(Boolean).join(" · ")],
        ["Institut / enhed", d.department],
        ["Type", EVENT_TYPE_LABEL[d.eventType]],
        ["Dato", `${formatDay(new Date(`${d.date}T12:00:00Z`))} · ${d.startTime.replace(":", ".")}${d.endTime ? `–${d.endTime.replace(":", ".")}` : ""}`],
        ["Lokale", d.location],
        ["Foyer", d.foyerUsed && [d.foyerPodiums && `${d.foyerPodiums} podier`, d.foyerMics && `${d.foyerMics} mikrofoner`, d.foyerTables && `${d.foyerTables} letvægtsborde`, d.foyerSound && "lyd fra anlægget"].filter(Boolean).join(" · ") || (d.foyerUsed && "Ja")],
        ["Deltagere", d.expectedAttendees != null && String(d.expectedAttendees)],
        ["Medhjælpere ønsket", d.helpersWanted != null && String(d.helpersWanted)],
        ["Scene / podier", d.stage && (d.stageDetails || "Ja")],
        ["Projektor", d.projector && "Ja"],
        ["Lyd fra computer", d.pcAudio && "Ja"],
        ["Lys", d.light && [LIGHTING_LABEL[d.lightingPreset], d.lightingNotes].filter(Boolean).join(" — ")],
        ["Mikrofoner", d.sound && [d.micCount ? `${d.micCount} stk.` : "", d.micPurpose].filter(Boolean).join(" — ")],
        ["Bands", d.bands && (d.bandDetails || "Ja")],
        ["Stole / borde", [d.chairs != null && `${d.chairs} stole`, d.tables != null && `${d.tables} borde`, d.furnitureNotes].filter(Boolean).join(" · ")],
        ["Program", d.schedule],
        ["Andet", d.otherNotes],
      ]
    : [];

  return (
    <div className="space-y-6">
      <Link href="/admin/bestillinger" className="text-xs text-muted hover:text-fg">
        ← Bestillinger
      </Link>
      <div>
        <p className="text-xs text-muted">
          {request.label}
          {request.submittedAt && ` · sendt ${formatStamp(request.submittedAt)}`}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{d?.title ?? "Bestilling"}</h1>
      </div>

      {d ? (
        <dl className="divide-y divide-line border-y border-line">
          {rows
            .filter(([, v]) => !!v)
            .map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="whitespace-pre-wrap">{v}</dd>
              </div>
            ))}
        </dl>
      ) : (
        <p className="text-muted">
          {request.status === "OPEN" ? "Arrangøren har ikke udfyldt formularen endnu." : "Indholdet er slettet efter behandling."}
        </p>
      )}

      {request.status === "SUBMITTED" && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/arrangementer/ny?bestilling=${request.id}`} className={buttonClass("primary")}>
            Opret arrangement ud fra bestillingen
          </Link>
          <form action={archiveRequest}>
            <input type="hidden" name="requestId" value={request.id} />
            <button className={buttonClass("secondary")}>Arkivér</button>
          </form>
        </div>
      )}
      {request.eventId && (
        <Link href={`/admin/arrangementer/${request.eventId}`} className={buttonClass("secondary")}>
          Gå til arrangementet
        </Link>
      )}
    </div>
  );
}
