import Link from "next/link";
import { z } from "zod";
import { db } from "@/lib/db";
import { intakeSchema, intakeToForm } from "@/lib/events/intake";
import { requireUser } from "@/lib/session";
import { EventForm } from "../event-form";

export const metadata = { title: "Nyt arrangement · Bagscenen" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ bestilling?: string }> }) {
  await requireUser("LEAD");
  const { bestilling } = await searchParams;
  const requestId = z.cuid().safeParse(bestilling).success ? bestilling : undefined;

  const request = requestId ? await db.eventRequest.findFirst({ where: { id: requestId, status: "SUBMITTED" } }) : null;

  const parsedIntake = request ? intakeSchema.safeParse(request.data) : null;
  const intake = parsedIntake?.success ? parsedIntake.data : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/arrangementer" className="text-xs text-muted hover:text-fg">
          ← Arrangementer
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Nyt arrangement</h1>
        {intake && <p className="text-xs text-muted">Udfyldt fra arrangørens bestilling ({request!.label}). Tjek det hele, og tilføj vagter.</p>}
      </div>
      <EventForm
        key={request?.id ?? "blank"}
        eventId={null}
        requestId={intake ? request!.id : undefined}
        initial={intake ? intakeToForm(intake) : null}
      />
    </div>
  );
}
