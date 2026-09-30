"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { runRetentionNow, type RetentionState } from "./actions";

export function RetentionButton() {
  const [state, action] = useActionState<RetentionState, FormData>(runRetentionNow, {});
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="secondary">Kør oprydning nu</SubmitButton>
      {state.summary && <p className="text-xs text-ok">{state.summary}</p>}
    </form>
  );
}
