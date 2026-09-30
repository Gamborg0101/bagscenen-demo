import type { Channel, ChannelPlan } from "@prisma/client";
import { DI_LABEL, MIXERS, inputLabel, summarize } from "@/lib/channel-plan";

type Plan = ChannelPlan & { channels: Channel[] };

/** Read-only channel plan: a table on wide screens and on paper, a list on phones. */
export function ChannelPlanView({ plan }: { plan: Plan }) {
  const channels = [...plan.channels].sort((a, b) => a.number - b.number);
  const s = summarize(
    channels.map((c) => ({
      number: c.number,
      source: c.source,
      gear: c.gear ?? "",
      di: c.di,
      phantom: c.phantom,
      inputSource: c.inputSource ?? "",
      inputNumber: c.inputNumber,
      note: c.note ?? "",
    })),
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {MIXERS[plan.mixer].label} · {s.channels} kanaler
        {s.monoDi > 0 && ` · ${s.monoDi} mono DI`}
        {s.stereoDi > 0 && ` · ${s.stereoDi} stereo DI`}
        {s.phantom > 0 && ` · 48V på ${s.phantom}`}
      </p>
      {s.duplicateInputs.length > 0 && <p className="text-xs font-semibold text-danger">Samme input bruges to gange: {s.duplicateInputs.join(", ")}</p>}

      {channels.length === 0 ? (
        <p className="text-muted">Ingen kanaler endnu.</p>
      ) : (
        <>
          {/* Phones */}
          <ol className="divide-y divide-line border-y border-line sm:hidden print:hidden">
            {channels.map((c) => (
              <li key={c.id} className="flex gap-3 py-2">
                <span className="w-7 shrink-0 text-right font-semibold tabular-nums">{c.number}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.source || "–"}</p>
                  <p className="text-xs text-muted">
                    {[c.gear, c.di !== "NONE" && DI_LABEL[c.di], c.phantom && "48V", inputLabel(c.inputSource, c.inputNumber)].filter(Boolean).join(" · ")}
                  </p>
                  {c.note && <p className="text-xs">{c.note}</p>}
                </div>
              </li>
            ))}
          </ol>

          {/* Wide screens and print */}
          <table className="hidden w-full border-collapse text-sm sm:table print:table print:text-[11px]">
            <thead>
              <tr className="border-b border-fg text-left text-xs text-muted">
                <th className="w-12 py-1.5 pr-2 text-right">Kanal</th>
                <th className="py-1.5 pr-2">Kilde</th>
                <th className="py-1.5 pr-2">Mikrofon</th>
                <th className="py-1.5 pr-2">DI</th>
                <th className="py-1.5 pr-2">48V</th>
                <th className="py-1.5 pr-2">Input</th>
                <th className="py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id} className="border-b border-line align-top">
                  <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{c.number}</td>
                  <td className="py-1.5 pr-2 font-medium">{c.source}</td>
                  <td className="py-1.5 pr-2">{c.gear}</td>
                  <td className="py-1.5 pr-2">{c.di !== "NONE" ? DI_LABEL[c.di] : ""}</td>
                  <td className="py-1.5 pr-2">{c.phantom ? "48V" : ""}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums">{inputLabel(c.inputSource, c.inputNumber)}</td>
                  <td className="py-1.5">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
