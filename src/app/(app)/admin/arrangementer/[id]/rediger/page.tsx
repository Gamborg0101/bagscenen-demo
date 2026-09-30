import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { eventToForm } from "@/lib/events/form";
import { getEventWithRelations } from "@/lib/events/queries";
import { requireUser } from "@/lib/session";
import { EventForm } from "../../event-form";

export const metadata = { title: "Redigér arrangement · Bagscenen" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("LEAD");
  const { id } = await params;
  if (!z.cuid().safeParse(id).success) notFound();
  const event = await getEventWithRelations(id);
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/arrangementer/${event.id}`} className="text-xs text-muted hover:text-fg">
          ← {event.title}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Redigér arrangement</h1>
      </div>
      <EventForm eventId={event.id} initial={eventToForm(event)} />
    </div>
  );
}
