import Link from "next/link";
import type { ChannelPlan } from "@prisma/client";
import { MIXERS } from "@/lib/channel-plan";
import { Section } from "./event-sheet";
import { NewPlanForm, type CopySource } from "./new-plan-form";

type PlanRow = ChannelPlan & { _count: { channels: number } };

/** The event's channel plans: the event's own plan and one per band. */
export function PlansSection({
  eventId,
  plans,
  canEdit,
  bands,
  sources = [],
}: {
  eventId: string;
  plans: PlanRow[];
  canEdit: boolean;
  bands: boolean;
  sources?: CopySource[];
}) {
  // Only events with bands get channel plans; plans made before bands was switched off stay visible.
  if (plans.length === 0 && (!canEdit || !bands)) return null;
  return (
    <Section title="Kanalplaner">
      <div className="space-y-3">
        {plans.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={`/arrangementer/${eventId}/kanalplan/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-subtle">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{p.kind === "EVENT" ? "Arrangementet" : p.name}</span>
                    <span className="block text-xs text-muted">
                      {MIXERS[p.mixer].label} · {p._count.channels} kanaler
                    </span>
                  </span>
                  <span className="text-xs">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {canEdit && bands && <NewPlanForm eventId={eventId} hasEventPlan={plans.some((p) => p.kind === "EVENT")} sources={sources} />}
      </div>
    </Section>
  );
}
