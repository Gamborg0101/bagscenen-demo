import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { CoverageTimeline } from "@/components/coverage-timeline";
import { EventSheet, Section } from "@/components/event-sheet";
import { NotesLog } from "@/components/notes-log";
import { PlansSection } from "@/components/plans-section";
import { copySources, eventPlans } from "@/lib/channel-plan-queries";
import { toDateInput } from "@/lib/datetime";
import { canViewEvent, eventInvitations, eventNotes } from "@/lib/events/access";
import { describeAvailability } from "@/lib/events/format";
import { getEventWithRelations } from "@/lib/events/queries";
import { isEventLocked } from "@/lib/events/response";
import { displayName, eventCoverage, initialAnswer, notesView, shiftOptions, staffingFrom, timelineHelpers } from "@/lib/events/view";
import { hasRole, requireUser } from "@/lib/session";
import { ResponseForm } from "./response-form";

export default async function HelperEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.cuid().safeParse(id).success) notFound();

  const event = await getEventWithRelations(id);
  // Same response whether the event is missing or not visible, so ids can't be probed.
  if (!event || !(await canViewEvent(user, event))) notFound();

  const [invitations, notes, plans] = await Promise.all([eventInvitations(id), eventNotes(id), eventPlans(id)]);
  const row = invitations.find((i) => i.userId === user.id);
  // Leads who aren't on the event themselves use the admin view.
  if (!row && hasRole(user.role, "LEAD")) redirect(`/admin/arrangementer/${id}`);
  // Helpers who haven't answered yet see the event as open.
  const mine = row ?? { status: "PENDING" as const, availabilities: [] };

  const eventDay = toDateInput(event.startsAt);
  const canEditPlanList = mine.status === "ACCEPTED" && !isEventLocked(event);
  const coverage = eventCoverage(event.shifts, invitations);
  const coHelpers = invitations.filter((i) => i.status === "ACCEPTED" && i.userId !== user.id);
  const multiDay = new Set([eventDay, ...event.shifts.map((s) => toDateInput(s.startsAt))]).size > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-xs text-muted hover:text-fg">
          ← Forsiden
        </Link>
        <a href={`/arrangementer/${event.id}/kalender`} download className="text-xs text-muted underline underline-offset-2 hover:text-fg">
          Tilføj til kalender
        </a>
      </div>

      <EventSheet
        event={event}
        staffing={staffingFrom(coverage)}
        afterHeader={
          <ResponseForm
            eventId={event.id}
            eventDay={eventDay}
            multiDay={multiDay}
            locked={isEventLocked(event)}
            cancelled={event.status === "CANCELLED"}
            status={mine.status}
            summary={describeAvailability(mine.availabilities, event.shifts, eventDay)}
            shifts={shiftOptions(event.shifts, eventDay)}
            initial={initialAnswer(mine.availabilities)}
          />
        }
        afterShifts={
          <Section title="Hvem er på">
            {event.shifts.length > 0 && (
              <div className="mb-4">
                <CoverageTimeline shifts={event.shifts} coverage={coverage} helpers={timelineHelpers(invitations, event.shifts, user.id)} />
              </div>
            )}
            {coHelpers.length === 0 ? (
              <p className="text-muted">{mine.status === "ACCEPTED" ? "Kun dig indtil videre." : "Ingen har meldt sig endnu."}</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {coHelpers.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{displayName(i.user)}</p>
                      <p className="text-xs text-muted tabular-nums">{describeAvailability(i.availabilities, event.shifts, eventDay).join(", ")}</p>
                    </div>
                    {/* Phone numbers only for helpers who are on the event themselves (data minimisation). */}
                    {mine.status === "ACCEPTED" && !i.user.anonymizedAt && (
                      <a href={`tel:${i.user.phone}`} className="rounded-md border border-line px-3 py-1.5 hover:bg-subtle">
                        Ring <span className="text-muted tabular-nums">{i.user.phone}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        }
      >
        <PlansSection eventId={event.id} plans={plans} bands={event.bands} canEdit={canEditPlanList} sources={canEditPlanList ? await copySources(user, id) : []} />
        <NotesLog eventId={event.id} notes={notesView(notes, user)} canWrite={mine.status === "ACCEPTED" && !isEventLocked(event)} />
      </EventSheet>
    </div>
  );
}
