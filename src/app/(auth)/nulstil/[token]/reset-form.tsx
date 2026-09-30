"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { resetPasswordAction, type FormState } from "../../actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error ?? err.token?.[0]} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="Ny adgangskode"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="Mindst 10 tegn"
        error={err.password}
      />
      <Field label="Gentag adgangskode" name="passwordConfirm" type="password" autoComplete="new-password" required error={err.passwordConfirm} />
      <SubmitButton className="w-full">Gem adgangskode</SubmitButton>
    </form>
  );
}
