import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { ChannelRow } from "@/lib/channel-plan";
import { getPlan } from "@/lib/channel-plan-queries";
import { canEditPlans, canViewEvent } from "@/lib/events/access";
import { requireUser } from "@/lib/session";
import { ChannelEditor } from "./channel-editor";

export const metadata = { title: "Redigér kanalplan · Bagscenen" };

export default async function EditPlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const user = await requireUser();
  const { id, planId } = await params;
  if (!z.cuid().safeParse(planId).success) notFound();
  const plan = await getPlan(planId);
  if (!plan || plan.eventId !== id || !(await canViewEvent(user, plan.event))) notFound();
  if (!(await canEditPlans(user, plan.event))) redirect(`/arrangementer/${id}/kanalplan/${planId}`);

  const rows: ChannelRow[] = plan.channels.map((c) => ({
    number: c.number,
    source: c.source,
    gear: c.gear ?? "",
    di: c.di,
    phantom: c.phantom,
    inputSource: c.inputSource ?? "",
    inputNumber: c.inputNumber,
    note: c.note ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/arrangementer/${id}`} className="text-xs text-muted hover:text-fg">
          ← {plan.event.title}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Kanalplan · {plan.name}</h1>
      </div>
      <ChannelEditor
        eventId={id}
        plan={{ id: plan.id, kind: plan.kind, name: plan.name, mixer: plan.mixer, version: plan.updatedAt.toISOString() }}
        initialRows={rows}
      />
    </div>
  );
}
