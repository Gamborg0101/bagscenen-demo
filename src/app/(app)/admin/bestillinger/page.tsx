import Link from "next/link";
import type { RequestStatus } from "@prisma/client";
import { buttonClass } from "@/components/styles";
import { formatShortDay, formatStamp } from "@/lib/datetime";
import { db } from "@/lib/db";
import { intakeSchema } from "@/lib/events/intake";
import { requireUser } from "@/lib/session";
import { archiveRequest } from "./actions";
import { RequestLinkForm } from "./request-link-form";

export const metadata = { title: "Bestillinger · Bagscenen" };

const STATUS_LABEL: Record<RequestStatus, string> = {
  OPEN: "Venter på arrangør",
  SUBMITTED: "Ny bestilling",
  CONVERTED: "Oprettet som arrangement",
  ARCHIVED: "Arkiveret",
};

export default async function RequestsPage() {
  await requireUser("LEAD");
  const requests = await db.eventRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  const submitted = requests.filter((r) => r.status === "SUBMITTED");
  const open = requests.filter((r) => r.status === "OPEN");
  const done = requests.filter((r) => r.status === "CONVERTED" || r.status === "ARCHIVED").slice(0, 30);

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bestillinger</h1>
          <p className="text-xs text-muted">
            Send et link til arrangøren, så udfylder de selv guiden. Du laver det bagefter om til et arrangement med ét klik.
          </p>
        </div>
        <RequestLinkForm />
      </div>

      <Section title="Nye bestillinger" count={submitted.length} empty="Ingen nye bestillinger.">
        {submitted.map((r) => {
          const d = intakeSchema.safeParse(r.data);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/admin/bestillinger/${r.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="font-medium">{d.success ? d.data.title : r.label}</p>
                <p className="text-xs text-muted">
                  {r.label}
                  {d.success && ` · ${formatShortDay(new Date(`${d.data.date}T12:00:00Z`))} ${d.data.startTime.replace(":", ".")}`}
                </p>
              </Link>
              <Link href={`/admin/bestillinger/${r.id}`} className={buttonClass("primary")}>
                Se bestilling
              </Link>
            </li>
          );
        })}
      </Section>

      <Section title="Venter på arrangør" count={open.length} empty="Ingen åbne links.">
        {open.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p>{r.label}</p>
              <p className="text-xs text-muted">
                Sendt {formatStamp(r.createdAt)} · {r.expiresAt < new Date() ? "udløbet" : `udløber ${formatShortDay(r.expiresAt)}`}
              </p>
            </div>
            <form action={archiveRequest}>
              <input type="hidden" name="requestId" value={r.id} />
              <button className="text-xs text-muted hover:text-danger">Luk link</button>
            </form>
          </li>
        ))}
      </Section>

      {done.length > 0 && (
        <Section title="Behandlet" count={done.length}>
          {done.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5 text-muted">
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              {r.eventId ? (
                <Link href={`/admin/arrangementer/${r.eventId}`} className="text-xs underline">
                  {STATUS_LABEL[r.status]}
                </Link>
              ) : (
                <span className="text-xs">{STATUS_LABEL[r.status]}</span>
              )}
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        {title} <span className="tabular-nums">({count})</span>
      </h2>
      {count === 0 ? <p className="text-muted">{empty}</p> : <ul className="divide-y divide-line border-y border-line">{children}</ul>}
    </section>
  );
}
