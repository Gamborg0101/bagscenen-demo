"use client";

import { inputClass } from "./styles";

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  ...props
}: { value: string | null; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return <input className={inputClass} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...props} />;
}

export function TextArea({
  value,
  onChange,
  rows = 2,
  ...props
}: { value: string | null; onChange: (v: string) => void } & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>) {
  return (
    <textarea
      className={`${inputClass} resize-y`}
      rows={rows}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
}

/** Number input where empty means null. */
export function NumberInput({
  value,
  onChange,
  ...props
}: { value: number | null; onChange: (v: number | null) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      className={`${inputClass} tabular-nums`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))))}
      {...props}
    />
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 50,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const btn = "grid size-8 place-items-center rounded-md border border-line text-base hover:bg-subtle disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Færre: ${label}`}>
          −
        </button>
        <span className="w-6 text-center tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Flere: ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

/** Quick-pick values next to an input, e.g. 40 · 80 · 140 chairs. */
export function Chips<T extends string | number>({
  options,
  value,
  onPick,
  format = String,
}: {
  options: readonly T[];
  value: T | null;
  onPick: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onPick(o)}
          className={`rounded-full border px-2.5 py-0.5 text-xs tabular-nums ${
            value === o ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-current" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md border px-2.5 py-1.5 text-xs ${
            value === o.value ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
