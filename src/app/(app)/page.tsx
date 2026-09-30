import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { formatRange, formatShortDay, toDateInput } from "@/lib/datetime";
import { db } from "@/lib/db";
import { describeAvailability } from "@/lib/events/format";
import { staffingSummary } from "@/lib/events/view";
import { formatEventRef } from "@/lib/events/ref";
import { isEventLocked } from "@/lib/events/response";
import { hasRole, requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();

  const invitations = await db.invitation.findMany({
    where: { userId: user.id, event: { status: { not: "DRAFT" } } },
    include: { event: { include: { shifts: true } }, availabilities: { orderBy: { startsAt: "asc" } } },
    orderBy: { event: { startsAt: "asc" } },
  });

  const upcoming = invitations.filter((i) => !isEventLocked(i.event));
  const past = invitations.filter((i) => isEventLocked(i.event)).reverse().slice(0, 20);
  const accepted = upcoming.filter((i) => i.status === "ACCEPTED");
  const declined = upcoming.filter((i) => i.status === "DECLINED");

  const isLead = hasRole(user.role, "LEAD");
  const hasOwn = invitations.length > 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hej {user.firstName}</h1>
        {!isLead && (
          <Link href="/kom-godt-i-gang" className="text-xs text-muted underline underline-offset-2">
            Sådan virker Bagscenen
          </Link>
        )}
      </div>


      {isLead && <CoordinatorOverview />}

      {!isLead && <OpenEvents userId={user.id} />}
      {(!isLead || hasOwn) && <List title="Mine vagter" items={accepted} empty="Du er ikke på nogen kommende arrangementer." />}
      {declined.length > 0 && <List title="Kan ikke" items={declined} />}
      {past.length > 0 && <List title="Tidligere" items={past} muted />}
    </div>
  );
}

/** Upcoming events the helper hasn't answered yet: they can take shifts or say they can't come. */
async function OpenEvents({ userId }: { userId: string }) {
  const events = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      startsAt: { gte: new Date(Date.now() - 48 * 3600_000) },
      invitations: { none: { userId, status: { in: ["ACCEPTED", "DECLINED"] } } },
    },
    orderBy: { startsAt: "asc" },
    include: { shifts: true, invitations: { select: { status: true, userId: true, availabilities: true } } },
  });
  const open = events.filter((e) => !isEventLocked(e));

  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        Ledige vagter {open.length > 0 && <span className="tabular-nums">({open.length})</span>}
      </h2>
      {open.length === 0 ? (
        <p className="text-muted">Ingen arrangementer mangler svar fra dig lige nu.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-fg">
          {open.map((e) => {
            const s = staffingSummary(e.shifts, e.invitations);
            return (
              <li key={e.id}>
                <Link href={`/arrangementer/${e.id}`} className="flex gap-4 py-3 hover:bg-subtle">
                  <div className="w-20 shrink-0 text-xs text-muted tabular-nums">
                    <p className="first-letter:uppercase">{formatShortDay(e.startsAt)}</p>
                    <p>{formatRange(e.startsAt, e.endsAt)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted">{[formatEventRef(e), e.location].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="self-center text-right text-xs">
                    {s && (s.covered ? <span className="text-ok">Dækket</span> : <span className="text-warn">Mangler {s.missing}</span>)}
                    <span className="block">Svar →</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The next events and their staffing, for coordinators. */
async function CoordinatorOverview() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const events = await db.event.findMany({
    where: { startsAt: { gte: since }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    take: 6,
    include: { shifts: true, invitations: { select: { status: true, userId: true, availabilities: true } } },
  });
  const rows = events.map((e) => ({ e, s: e.status === "PUBLISHED" ? staffingSummary(e.shifts, e.invitations) : null }));

  return (
    <>

      <section>
        <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Kommende arrangementer</h2>
        {rows.length === 0 ? (
          <p className="text-muted">Ingen kommende arrangementer.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {rows.map(({ e, s }) => (
              <li key={e.id}>
                <Link href={`/admin/arrangementer/${e.id}`} className="flex gap-4 py-3 hover:bg-subtle">
                  <div className="w-20 shrink-0 text-xs text-muted tabular-nums">
                    <p className="first-letter:uppercase">{formatShortDay(e.startsAt)}</p>
                    <p>{formatRange(e.startsAt, e.endsAt)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted">{[formatEventRef(e), e.location].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="self-center text-right text-xs">
                    {e.status === "DRAFT" ? (
                      <span className="text-muted">Kladde</span>
                    ) : s ? (
                      <>
                        <span className={s.covered ? "text-ok" : "text-warn"}>{s.covered ? "Dækket" : "Mangler medhjælp"}</span>
                        <span className="block text-muted tabular-nums">{s.accepted} på</span>
                      </>
                    ) : (
                      <span className="text-muted">Ingen vagter</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

type Item = Prisma.InvitationGetPayload<{ include: { event: { include: { shifts: true } }; availabilities: true } }>;

function List({ title, items, empty, muted }: { title: string; items: Item[]; empty?: string; muted?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        {title} {items.length > 0 && <span className="tabular-nums">({items.length})</span>}
      </h2>
      {items.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((i) => {
            const e = i.event;
            const eventDay = toDateInput(e.startsAt);
            const mine = i.status === "ACCEPTED" ? describeAvailability(i.availabilities, e.shifts, eventDay).join(", ") : null;
            return (
              <li key={i.id}>
                <Link href={`/arrangementer/${e.id}`} className={`flex gap-4 py-3 hover:bg-subtle ${muted ? "opacity-70" : ""}`}>
                  <div className="w-20 shrink-0 text-xs text-muted tabular-nums">
                    <p className="first-letter:uppercase">{formatShortDay(e.startsAt)}</p>
                    <p>{formatRange(e.startsAt, e.endsAt)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${e.status === "CANCELLED" ? "line-through" : ""}`}>{e.title}</p>
                    <p className="truncate text-xs text-muted">
                      {e.status === "CANCELLED" ? <span className="text-danger">Aflyst</span> : mine ? <span className="text-fg">{mine}</span> : e.location}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
