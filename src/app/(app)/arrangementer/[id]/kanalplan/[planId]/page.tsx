import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChannelPlanView } from "@/components/channel-plan-view";
import { PrintButton } from "@/components/print-button";
import { TechRiderPanel } from "@/components/techrider-panel";
import { buttonClass } from "@/components/styles";
import { getPlan } from "@/lib/channel-plan-queries";
import { formatDay, formatRange, formatStamp } from "@/lib/datetime";
import { canEditPlans, canViewEvent } from "@/lib/events/access";
import { planShareKey } from "@/lib/plan-share";
import { qrSvg } from "@/lib/qr";
import { requireUser } from "@/lib/session";
import { appUrl } from "@/lib/url";
import { setPlanShare } from "../actions";

export const metadata = { title: "Kanalplan · Bagscenen" };

export default async function PlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const user = await requireUser();
  const { id, planId } = await params;
  if (!z.cuid().safeParse(planId).success) notFound();
  const plan = await getPlan(planId);
  if (!plan || plan.eventId !== id || !(await canViewEvent(user, id, plan.event.status))) notFound();
  const canEdit = await canEditPlans(user, plan.event);

  const shareActive = plan.shareEnabled && !!plan.shareExpiresAt && plan.shareExpiresAt > new Date();
  const shareUrl = shareActive ? `${await appUrl()}/kanalplan/${planShareKey(plan.id, plan.shareVersion)}` : null;
  const qr = shareUrl ? await qrSvg(shareUrl) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/arrangementer/${id}`} className="mr-auto text-xs text-muted hover:text-fg">
          ← {plan.event.title}
        </Link>
        <PrintButton label="Print / gem som PDF" />
        {canEdit && (
          <Link href={`/arrangementer/${id}/kanalplan/${planId}/rediger`} className={buttonClass("primary")}>
            Redigér
          </Link>
        )}
      </div>

      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {plan.event.title} · <span className="first-letter:uppercase">{formatDay(plan.event.startsAt)}</span> ·{" "}
            {formatRange(plan.event.startsAt, plan.event.endsAt)}
            {plan.event.location && ` · ${plan.event.location}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Kanalplan · {plan.name}</h1>
        </div>
        {/* On paper the QR code sits in the corner, so others can open the plan on their phone. */}
        {qr && <div aria-hidden className="hidden size-24 shrink-0 print:block" dangerouslySetInnerHTML={{ __html: qr }} />}
      </header>

      <ChannelPlanView plan={plan} />

      <TechRiderPanel
        url={`/arrangementer/${id}/kanalplan/${planId}/techrider`}
        file={plan.techRider ? { filename: plan.techRider.filename, size: plan.techRider.size, uploadedAt: plan.techRider.createdAt.toISOString() } : null}
        canEdit={canEdit}
      />

      {(canEdit || qr) && (
        <section className="space-y-3 border-t border-line pt-6 print:hidden">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Del med andre</h2>
          {qr && shareUrl ? (
            <div className="flex flex-wrap items-start gap-4">
              <div className="size-40 shrink-0 rounded-md bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs text-muted">
                  Alle med QR-koden eller linket kan se kanalplanen (kun læse, uden login). Den indeholder ingen personoplysninger.
                </p>
                <p className="text-xs font-medium">Linket udløber {formatStamp(plan.shareExpiresAt!)}.</p>
                <p className="text-xs break-all select-all">{shareUrl}</p>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <ShareButton planId={plan.id} mode="new" label="Lav nyt link (8 timer)" />
                    <ShareButton planId={plan.id} mode="off" label="Slå deling fra" danger />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                {plan.shareEnabled ? "Linket er udløbet. " : ""}Lav en QR-kode, så bandets tekniker og andre kan se planen på telefonen
                uden login. Linket virker i 8 timer.
              </p>
              <ShareButton planId={plan.id} mode="on" label="Lav QR-kode og link" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ShareButton({ planId, mode, label, danger }: { planId: string; mode: "on" | "off" | "new"; label: string; danger?: boolean }) {
  return (
    <form action={setPlanShare}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="mode" value={mode} />
      <button className={buttonClass(danger ? "danger" : "secondary", "sm")}>{label}</button>
    </form>
  );
}
