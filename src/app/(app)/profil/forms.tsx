"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { changePassword, deleteOwnAccount, updateProfile, type ProfileState } from "./actions";

export function ProfileForm({ firstName, lastName, phone }: { firstName: string; lastName: string; phone: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, {});
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      <FormMessage error={state.error} success={state.ok} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fornavn" name="firstName" defaultValue={firstName} required error={err.firstName} />
        <Field label="Efternavn" name="lastName" defaultValue={lastName} required error={err.lastName} />
      </div>
      <Field label="Telefon" name="phone" type="tel" defaultValue={phone} required error={err.phone} />
      <SubmitButton>Gem</SubmitButton>
    </form>
  );
}

export function PasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(changePassword, {});
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      {/* Lets password managers know which account this is for. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <FormMessage error={state.error} success={state.ok} />
      <Field label="Nuværende adgangskode" name="current" type="password" autoComplete="current-password" required error={err.current} />
      <Field label="Ny adgangskode" name="password" type="password" autoComplete="new-password" minLength={10} hint="Mindst 10 tegn" required error={err.password} />
      <Field label="Gentag ny adgangskode" name="passwordConfirm" type="password" autoComplete="new-password" required error={err.passwordConfirm} />
      <SubmitButton variant="secondary">Skift adgangskode</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<ProfileState, FormData>(deleteOwnAccount, {});
  return (
    <form action={action} className="space-y-3">
      <FormMessage error={state.error} />
      <Field label="Skriv SLET for at bekræfte" name="confirm" autoComplete="off" required />
      <SubmitButton variant="danger">Slet min konto</SubmitButton>
    </form>
  );
}
