"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, inputClass } from "./styles";

export function Field({
  label,
  name,
  error,
  hint,
  ...props
}: {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        className={inputClass}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: { variant?: "primary" | "secondary" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={`${buttonClass(variant)} ${className}`}
      {...props}
    >
      {pending ? "…" : children}
    </button>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="rounded-md bg-subtle px-3 py-2 text-xs text-danger">{error}</p>;
  if (success) return <p className="rounded-md bg-subtle px-3 py-2 text-xs text-ok">{success}</p>;
  return null;
}
