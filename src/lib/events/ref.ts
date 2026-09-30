// Human-readable event ids like "2026-012": the year of the event date (Copenhagen) when it was
// created, and a running number that starts over each year. No "server-only": the demo seed uses it too.
import { Prisma, type PrismaClient } from "@prisma/client";
import { toDateInput } from "@/lib/datetime";

export type EventRef = { refYear: number; refNumber: number };

export function formatEventRef(e: EventRef): string {
  return `${e.refYear}-${String(e.refNumber).padStart(3, "0")}`;
}

/** Search input → ref: "2026-012", "2026-12", "#12" or "12" (any year). */
export function parseEventRef(query: string): { refYear?: number; refNumber: number } | null {
  const m = query.trim().match(/^#?(?:(\d{4})-)?(\d{1,4})$/);
  if (!m) return null;
  const refNumber = Number(m[2]);
  if (refNumber < 1) return null;
  return m[1] ? { refYear: Number(m[1]), refNumber } : { refNumber };
}

export function eventRefYear(startsAt: Date): number {
  return Number(toDateInput(startsAt).slice(0, 4));
}

type Db = PrismaClient | Prisma.TransactionClient;

async function nextEventRef(db: Db, startsAt: Date): Promise<EventRef> {
  const refYear = eventRefYear(startsAt);
  const last = await db.event.aggregate({ where: { refYear }, _max: { refNumber: true } });
  return { refYear, refNumber: (last._max.refNumber ?? 0) + 1 };
}

/** Runs `create` with the next free number, retrying if two events were created at the same moment. */
export async function withEventRef<T>(db: Db, startsAt: Date, create: (ref: EventRef) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const ref = await nextEventRef(db, startsAt);
    try {
      return await create(ref);
    } catch (e) {
      const taken = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!taken || attempt >= 3) throw e;
    }
  }
}
