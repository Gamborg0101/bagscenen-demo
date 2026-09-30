"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { ORG } from "@/lib/org";
import { loginAction, type FormState } from "../actions";

export function LoginForm({ reset, next }: { reset: boolean; next: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage
        error={state.error}
        success={reset && !state.error ? "Din adgangskode er ændret. Log ind med den nye." : undefined}
      />
      <Field
        label={ORG.emailLabel}
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
      />
      <Field label="Adgangskode" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton className="w-full">Log ind</SubmitButton>
    </form>
  );
}
