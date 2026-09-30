import { notFound } from "next/navigation";
import { z } from "zod";
import { availabilityWindow, canViewEvent } from "@/lib/events/access";
import { shiftName } from "@/lib/events/format";
import { getEventWithRelations } from "@/lib/events/queries";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const TWO_HOURS = 2 * 3600_000;

// "Tilføj til kalender": the viewer's own shifts (or the event itself if they haven't said yes).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.cuid().safeParse(id).success) notFound();
  const event = await getEventWithRelations(id);
  if (!event || !(await canViewEvent(user, id, event.status))) notFound();

  const mine = await db.invitation.findUnique({
    where: { eventId_userId: { eventId: id, userId: user.id } },
    include: { availabilities: { orderBy: { startsAt: "asc" } } },
  });

  const url = new URL(`/arrangementer/${id}`, request.url).toString();
  const fallbackEnd = (start: Date) => event.endsAt ?? new Date(start.getTime() + TWO_HOURS);

  const entries: IcsEvent[] =
    mine?.status === "ACCEPTED" && mine.availabilities.length
      ? mine.availabilities.map((a) => {
          const w = availabilityWindow(a, event.shifts);
          const shift = a.shiftId ? event.shifts.find((s) => s.id === a.shiftId) : undefined;
          const end = w.end ?? fallbackEnd(w.start);
          return {
            uid: `${a.id}@bagscenen`,
            start: w.start,
            end: end > w.start ? end : new Date(w.start.getTime() + TWO_HOURS),
            summary: `${shift ? shiftName(shift) : "Vagt"}: ${event.title}`,
            location: event.location,
            description: `Se detaljer, kontaktpersoner og noter i Bagscenen:\n${url}`,
            url,
          };
        })
      : [
          {
            uid: `${event.id}@bagscenen`,
            start: event.startsAt,
            end: fallbackEnd(event.startsAt),
            summary: event.title,
            location: event.location,
            description: url,
            url,
          },
        ];

  // Deliberately no names or phone numbers of others in the file.
  return new Response(buildIcs(entries), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bagscenen.ics"',
      "Cache-Control": "no-store",
    },
  });
}
