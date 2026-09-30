"use client";

import { useActionState, useState } from "react";
import { buttonClass, inputClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { createRequestLink, type RequestLinkState } from "./actions";

export function RequestLinkForm() {
  const [state, action] = useActionState<RequestLinkState, FormData>(createRequestLink, {});
  const [copied, setCopied] = useState(false);

  if (state.url) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input readOnly value={state.url} aria-label="Bestillingslink" className={`${inputClass} text-xs`} onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className={buttonClass("secondary")}
            onClick={async () => {
              await navigator.clipboard.writeText(state.url!);
              setCopied(true);
            }}
          >
            {copied ? "Kopieret" : "Kopiér"}
          </button>
        </div>
        <p className="text-xs text-muted">Send linket til arrangøren. Det kan bruges én gang og udløber om 30 dage. Det vises kun nu.</p>
        <button type="button" className="text-xs underline" onClick={() => window.location.reload()}>
          Opret et link mere
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input name="label" required maxLength={200} placeholder="Til hvem? Fx Institut for Kultur og Samfund" className={`${inputClass} min-w-60 flex-1`} aria-label="Til hvem" />
      <SubmitButton>Opret bestillingslink</SubmitButton>
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}
