import "server-only";
import { db } from "@/lib/db";

export function getEventWithRelations(id: string) {
  return db.event.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { sortKey: "asc" } },
      shifts: { orderBy: { startsAt: "asc" } },
    },
  });
}

export type EventWithRelations = NonNullable<Awaited<ReturnType<typeof getEventWithRelations>>>;

