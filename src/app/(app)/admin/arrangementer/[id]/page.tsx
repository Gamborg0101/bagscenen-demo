import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { InvitationStatus } from "@prisma/client";
import { CoverageTimeline } from "@/components/coverage-timeline";
import { EventSheet, Section } from "@/components/event-sheet";
import { NotesLog } from "@/components/notes-log";
import { PlansSection } from "@/components/plans-section";
import { copySources, eventPlans } from "@/lib/channel-plan-queries";
import { buttonClass } from "@/components/styles";
import { toDateInput } from "@/lib/datetime";
import { db } from "@/lib/db";
import { eventInvitations, eventNotes } from "@/lib/events/access";
import { describeAvailability } from "@/lib/events/format";
import { getEventWithRelations } from "@/lib/events/queries";
import { displayName, eventCoverage, initialAnswer, notesView, shiftOptions, staffingFrom, timelineHelpers } from "@/lib/events/view";
import { isEventLocked } from "@/lib/events/response";
import { ResponseForm } from "@/app/(app)/arrangementer/[id]/response-form";
import { requireUser } from "@/lib/session";
import { deleteDraft, removeInvitation } from "../actions";
import { InvitePicker } from "./invite-controls";

const STATUS: Record<InvitationStatus, { label: string; className: string }> = {
  ACCEPTED: { label: "Er på", className: "text-ok" },
  PENDING: { label: "Afventer svar", className: "text-muted" },
  DECLINED: { label: "Kan ikke", className: "text-danger" },
};

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("LEAD");
  const { id } = await params;
  if (!z.cuid().safeParse(id).success) notFound();
  const event = await getEventWithRelations(id);
  if (!event) notFound();

  const [invitations, notes, activeUsers, plans] = await Promise.all([
    eventInvitations(id),
    eventNotes(id),
    db.user.findMany({
      where: { status: "ACTIVE", anonymizedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    eventPlans(id),
  ]);
  const sources = await copySources(user, id);

  const eventDay = toDateInput(event.startsAt);
  const coverage = eventCoverage(event.shifts, invitations);
  const options = shiftOptions(event.shifts, eventDay);
  const multiDay = new Set([eventDay, ...event.shifts.map((s) => toDateInput(s.startsAt))]).size > 1;
  const invitedIds = new Set(invitations.map((i) => i.userId));
  const candidates = activeUsers.filter((u) => !invitedIds.has(u.id)).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/arrangementer" className="mr-auto text-xs text-muted hover:text-fg">
          ← Arrangementer
        </Link>
        <Link href={`/admin/arrangementer/${event.id}/rediger`} className={buttonClass("primary")}>
          Redigér
        </Link>
      </div>

      <EventSheet
        event={event}
        staffing={staffingFrom(coverage)}
        afterShifts={
          <Section title="Medhjælpere">
            <div className="space-y-4">
              {event.shifts.length > 0 && (
                <CoverageTimeline shifts={event.shifts} coverage={coverage} helpers={timelineHelpers(invitations, event.shifts)} />
              )}

              {invitations.length > 0 && (
                <ul className="divide-y divide-line border-y border-line">
                  {invitations.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {displayName(i.user)} <span className={`ml-1 text-xs font-normal ${STATUS[i.status].className}`}>{STATUS[i.status].label}</span>
                        </p>
                        {i.availabilities.length > 0 && (
                          <p className="text-xs tabular-nums">{describeAvailability(i.availabilities, event.shifts, eventDay).join(", ")}</p>
                        )}
                        {i.note && <p className="text-xs text-muted">“{i.note}”</p>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {!i.user.anonymizedAt && (
                          <a href={`tel:${i.user.phone}`} className="text-muted hover:text-fg tabular-nums">
                            {i.user.phone}
                          </a>
                        )}
                        <form action={removeInvitation}>
                          <input type="hidden" name="invitationId" value={i.id} />
                          <button className="text-muted hover:text-danger">Fjern</button>
                        </form>
                      </div>
                      {/* Only the coordinator changes shifts once a helper is on. */}
                      <div className="w-full">
                        <ResponseForm
                          admin={{ invitationId: i.id, name: displayName(i.user) }}
                          eventId={event.id}
                          eventDay={eventDay}
                          multiDay={multiDay}
                          locked={isEventLocked(event)}
                          cancelled={event.status === "CANCELLED"}
                          status={i.status}
                          summary={[]}
                          shifts={options}
                          initial={initialAnswer(i.availabilities)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {event.status === "PUBLISHED" ? (
                <InvitePicker eventId={event.id} candidates={candidates} />
              ) : (
                <p className="text-xs text-muted">
                  {event.status === "DRAFT" ? "Sæt arrangementet til “Klar” for at invitere medhjælpere." : "Arrangementet er aflyst."}
                </p>
              )}
            </div>
          </Section>
        }
      >
        <PlansSection eventId={event.id} plans={plans} bands={event.bands} canEdit sources={sources} />
        <NotesLog eventId={event.id} notes={notesView(notes, user)} canWrite />
      </EventSheet>

      {event.status === "DRAFT" && (
        <form action={deleteDraft} className="border-t border-line pt-6">
          <input type="hidden" name="eventId" value={event.id} />
          <button className={buttonClass("danger")}>Slet kladde</button>
        </form>
      )}
    </div>
  );
}
