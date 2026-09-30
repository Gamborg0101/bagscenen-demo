import { ChannelPlanView } from "@/components/channel-plan-view";
import { PrintButton } from "@/components/print-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPlan } from "@/lib/channel-plan-queries";
import { formatDay, formatRange } from "@/lib/datetime";
import { parsePlanShareKey } from "@/lib/plan-share";

export const metadata = { title: "Kanalplan · Bagscenen", robots: { index: false, follow: false } };

// Public, read-only view opened from a QR code. Shows only the plan — no people, no contacts.
export default async function SharedPlanPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const parsed = parsePlanShareKey(key);
  const plan = parsed ? await getPlan(parsed.planId) : null;
  const valid =
    !!plan &&
    !!parsed &&
    plan.shareEnabled &&
    !!plan.shareExpiresAt &&
    plan.shareExpiresAt > new Date() &&
    plan.event.status !== "DRAFT" &&
    parsed.matches(plan.shareVersion);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 print:hidden">
        <span className="font-semibold tracking-tight">Bagscenen</span>
        <span className="flex-1" />
        {valid && <PrintButton label="Print / gem som PDF" />}
        <ThemeToggle />
      </div>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-16">
        {valid ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-muted">
                {plan.event.title} · <span className="first-letter:uppercase">{formatDay(plan.event.startsAt)}</span> ·{" "}
                {formatRange(plan.event.startsAt, plan.event.endsAt)}
                {plan.event.location && ` · ${plan.event.location}`}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Kanalplan · {plan.name}</h1>
            </div>
            <ChannelPlanView plan={plan} />
          </div>
        ) : (
          <p className="text-muted">Linket er ugyldigt, udløbet eller slået fra. Bed om en ny QR-kode.</p>
        )}
      </main>
    </div>
  );
}
