"use client";

import { useActionState, useState } from "react";
import { buttonClass, inputClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { createResetLink, type ResetLinkState } from "./actions";

export function ResetLinkButton({ userId }: { userId: string }) {
  const [state, action] = useActionState<ResetLinkState, FormData>(createResetLink, {});
  const [copied, setCopied] = useState(false);

  if (state.url) {
    return (
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <input readOnly value={state.url} className={`${inputClass} text-xs sm:w-56`} onFocus={(e) => e.target.select()} aria-label="Nulstillingslink" />
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          onClick={async () => {
            await navigator.clipboard.writeText(state.url!);
            setCopied(true);
          }}
        >
          {copied ? "Kopieret" : "Kopiér"}
        </button>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton variant="secondary" className="px-2.5! py-1.5! text-xs!" title="Opret et link (gyldigt i 24 timer), som du selv sender til medhjælperen">
        Nulstillingslink
      </SubmitButton>
      {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  );
}
