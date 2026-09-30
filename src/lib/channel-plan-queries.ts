import "server-only";
import { formatShortDay } from "@/lib/datetime";
import { db } from "@/lib/db";
import { hasRole, type CurrentUser } from "@/lib/session";

export function getPlan(planId: string) {
  return db.channelPlan.findUnique({
    where: { id: planId },
    include: {
      channels: { orderBy: { number: "asc" } },
      event: { select: { id: true, title: true, status: true, startsAt: true, endsAt: true, location: true } },
      techRider: { select: { filename: true, size: true, createdAt: true } }, // never the file itself here
    },
  });
}

export type PlanWithEvent = NonNullable<Awaited<ReturnType<typeof getPlan>>>;

export function eventPlans(eventId: string) {
  return db.channelPlan.findMany({
    where: { eventId },
    orderBy: [{ sortKey: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { channels: true } } },
  });
}

/** Plans the user may copy from: any for coordinators, otherwise only events they're invited to. */
export async function copySources(user: CurrentUser, excludeEventId: string) {
  const plans = await db.channelPlan.findMany({
    where: {
      eventId: { not: excludeEventId },
      channels: { some: {} },
      ...(hasRole(user.role, "LEAD") ? {} : { event: { invitations: { some: { userId: user.id } }, status: { not: "DRAFT" } } }),
    },
    orderBy: { event: { startsAt: "desc" } },
    take: 60,
    select: { id: true, kind: true, name: true, event: { select: { title: true, startsAt: true } }, _count: { select: { channels: true } } },
  });
  return plans.map((p) => ({
    id: p.id,
    label: `${p.kind === "EVENT" ? "Arrangementet" : p.name} — ${p.event.title} (${formatShortDay(p.event.startsAt)}) · ${p._count.channels} kanaler`,
  }));
}
