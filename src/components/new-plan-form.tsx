"use client";

import { useActionState, useState } from "react";
import type { Mixer } from "@prisma/client";
import { createPlan, type PlanActionResult } from "@/app/(app)/arrangementer/[id]/kanalplan/actions";
import { MIXERS } from "@/lib/channel-plan";
import { Segmented } from "./form-controls";
import { buttonClass, inputClass } from "./styles";
import { SubmitButton } from "./ui";

export type CopySource = { id: string; label: string };

export function NewPlanForm({ eventId, hasEventPlan, sources }: { eventId: string; hasEventPlan: boolean; sources: CopySource[] }) {
  const [state, action] = useActionState<PlanActionResult, FormData>(createPlan, {});
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"EVENT" | "BAND">(hasEventPlan ? "BAND" : "EVENT");
  const [mixer, setMixer] = useState<Mixer>("SQ7");

  if (!open) {
    return (
      <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setOpen(true)}>
        + Ny kanalplan
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-line p-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="mixer" value={mixer} />
      {!hasEventPlan && (
        <Segmented
          label="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "EVENT", label: "Arrangementet" },
            { value: "BAND", label: "Et band" },
          ]}
        />
      )}
      {kind === "BAND" && <input name="name" maxLength={120} placeholder="Bandets navn" aria-label="Bandets navn" className={inputClass} />}
      <div>
        <p className="mb-1 text-xs text-muted">Mixer</p>
        <Segmented label="Mixer" value={mixer} onChange={setMixer} options={(Object.keys(MIXERS) as Mixer[]).map((m) => ({ value: m, label: m === "MACKIE" ? "Mackie" : m }))} />
      </div>
      {sources.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted">Start fra en tidligere plan (valgfri)</p>
          <select name="copyFrom" aria-label="Kopiér fra tidligere plan" className={inputClass} defaultValue="">
            <option value="">Tom plan</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Kanaler og mixer kopieres. Bandets navn kan stå tomt, så bruges det fra planen.</p>
        </div>
      )}
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton>Opret</SubmitButton>
        <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>
          Annullér
        </button>
      </div>
    </form>
  );
}
