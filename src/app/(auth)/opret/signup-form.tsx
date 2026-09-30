"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { ORG } from "@/lib/org";
import { signupAction, type FormState } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signupAction, {});
  const err = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fornavn" name="firstName" autoComplete="given-name" required defaultValue={v.firstName} error={err.firstName} />
        <Field label="Efternavn" name="lastName" autoComplete="family-name" required defaultValue={v.lastName} error={err.lastName} />
      </div>
      <Field
        label={ORG.emailLabel}
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder={ORG.emailExample}
        defaultValue={v.email}
        error={err.email}
      />
      <Field label="Telefon" name="phone" type="tel" autoComplete="tel" required defaultValue={v.phone} error={err.phone} />
      <Field
        label="Adgangskode"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="Mindst 10 tegn"
        error={err.password}
      />
      <Field label="Gentag adgangskode" name="passwordConfirm" type="password" autoComplete="new-password" required error={err.passwordConfirm} />
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="privacyAccepted" required className="mt-0.5 accent-current" />
        <span>
          Jeg har læst{" "}
          <Link href="/privatliv" className="text-fg underline underline-offset-2">
            privatlivsinformationen
          </Link>{" "}
          om, hvordan mit navn, min {ORG.emailLabel} og mit telefonnummer bruges til planlægning af vagter.
        </span>
      </label>
      {err.privacyAccepted && <p className="text-xs text-danger">{err.privacyAccepted[0]}</p>}
      <SubmitButton className="w-full">Opret konto</SubmitButton>
    </form>
  );
}
