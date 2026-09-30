import Link from "next/link";
import type { EventType, Prisma } from "@prisma/client";
import { buttonClass, inputClass } from "@/components/styles";
import { formatRange, formatShortDay } from "@/lib/datetime";
import { db } from "@/lib/db";
import { EVENT_STATUS_LABEL, EVENT_TYPE_LABEL } from "@/lib/events/labels";
import { requireUser } from "@/lib/session";
import { staffingSummary } from "@/lib/events/view";
import { formatEventRef, parseEventRef } from "@/lib/events/ref";

export const metadata = { title: "Arrangementer · Bagscenen" };

type SearchParams = Promise<{ vis?: string; q?: string; type?: string }>;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("LEAD");
  const { vis, q, type } = await searchParams;
  const archive = vis === "arkiv";
  const query = q?.trim().slice(0, 100) ?? "";
  const eventType = type && type in EVENT_TYPE_LABEL ? (type as EventType) : undefined;
  const ref = parseEventRef(query);

  // An event counts as upcoming until the day after it starts.
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const where: Prisma.EventWhereInput = {
    startsAt: archive ? { lt: cutoff } : { gte: cutoff },
    ...(eventType && { eventType }),
    ...(query && {
      OR: [
        ...(ref ? [{ refNumber: ref.refNumber, ...(ref.refYear && { refYear: ref.refYear }) }] : []),
        { title: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
        { generalNotes: { contains: query, mode: "insensitive" } },
      ],
    }),
  };

  const events = await db.event.findMany({
    where,
    orderBy: { startsAt: archive ? "desc" : "asc" },
    take: 200,
    select: {
      id: true,
      title: true,
      refYear: true,
      refNumber: true,
      startsAt: true,
      endsAt: true,
      location: true,
      status: true,
      eventType: true,
      helpersWanted: true,
      shifts: true,
      invitations: { select: { status: true, userId: true, availabilities: true } },
    },
  });

  const tab = (active: boolean) => `pb-2 ${active ? "border-b-2 border-fg text-fg" : "text-muted hover:text-fg"}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Arrangementer</h1>
        <Link href="/admin/arrangementer/ny" className={buttonClass("primary")}>
          + Nyt
        </Link>
      </div>

      <nav className="flex gap-5 border-b border-line">
        <Link href="/admin/arrangementer" className={tab(!archive)}>
          Kommende
        </Link>
        <Link href="/admin/arrangementer?vis=arkiv" className={tab(archive)}>
          Arkiv
        </Link>
      </nav>

      <form className="flex gap-2">
        {archive && <input type="hidden" name="vis" value="arkiv" />}
        <input name="q" defaultValue={query} placeholder="Søg id, titel, lokale, noter" className={inputClass} aria-label="Søg" />
        <select name="type" defaultValue={eventType ?? ""} className={`${inputClass} w-auto!`} aria-label="Type">
          <option value="">Alle typer</option>
          {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button className={buttonClass("secondary")}>Søg</button>
      </form>

      {events.length === 0 ? (
        <p className="text-muted">{archive ? "Ingen tidligere arrangementer." : "Ingen kommende arrangementer."}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/arrangementer/${e.id}`} className="flex gap-4 py-3 hover:bg-subtle">
                <div className="w-20 shrink-0 text-xs text-muted tabular-nums">
                  <p className="first-letter:uppercase">{formatShortDay(e.startsAt)}</p>
                  <p>{formatRange(e.startsAt, e.endsAt)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${e.status === "CANCELLED" ? "line-through" : ""}`}>{e.title}</p>
                  <p className="truncate text-xs text-muted">
                    {[formatEventRef(e), e.location, EVENT_TYPE_LABEL[e.eventType]].filter(Boolean).join(" · ")}
                  </p>
                  {e.helpersWanted != null && (
                    <p className="truncate text-xs text-muted">
                      {e.helpersWanted} {e.helpersWanted === 1 ? "medhjælper" : "medhjælpere"} ønsket
                    </p>
                  )}
                </div>
                {e.status !== "PUBLISHED" ? (
                  <span className={`self-center text-xs ${e.status === "CANCELLED" ? "text-danger" : "text-muted"}`}>
                    {EVENT_STATUS_LABEL[e.status]}
                  </span>
                ) : (
                  <Staffing summary={staffingSummary(e.shifts, e.invitations)} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Staffing({ summary }: { summary: ReturnType<typeof staffingSummary> }) {
  if (!summary) return null;
  return (
    <span className="self-center text-right text-xs">
      <span className={summary.covered ? "text-ok" : "text-warn"}>{summary.covered ? "Dækket" : "Mangler medhjælp"}</span>
      <span className="block text-muted tabular-nums">
        {summary.accepted} på{summary.declined > 0 && ` · ${summary.declined} kan ikke`}
      </span>
    </span>
  );
}
