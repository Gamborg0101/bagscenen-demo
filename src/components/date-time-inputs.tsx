"use client";

import { useEffect, useRef, useState } from "react";
import { isoToDisplayDate, maskDate, maskTime, parseDate, parseTime } from "@/lib/datetime-input";
import { inputClass } from "./styles";

// Browsers render <input type="date|time"> in the device's language (e.g. mm/dd/yyyy and AM/PM on an
// English phone). These fields always show dd/mm/åååå and 24-hour tt:mm, whatever the device language.

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** "HH:MM" / "YYYY-MM-DD", or "" when empty or invalid. */
  value: string | null;
  onChange: (value: string) => void;
};

export function TimeInput({ value, onChange, className = "", onBlur, ...props }: FieldProps) {
  const [text, setText] = useState(value ?? "");
  const [invalid, setInvalid] = useState(false);

  // Follow changes from outside (e.g. "Standardvagter" filling in times).
  useEffect(() => {
    if ((parseTime(text) ?? "") !== (value ?? "")) {
      setText(value ?? "");
      setInvalid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={props.placeholder ?? "tt:mm"}
      maxLength={5}
      aria-invalid={invalid || undefined}
      className={`${inputClass} tabular-nums ${invalid ? "border-danger!" : ""} ${className}`}
      value={text}
      onChange={(e) => {
        const masked = maskTime(e.target.value);
        setText(masked);
        setInvalid(false);
        if (masked === "") onChange("");
        else if (masked.length === 5) onChange(parseTime(masked) ?? "");
      }}
      onBlur={(e) => {
        const parsed = parseTime(text);
        if (parsed) {
          setText(parsed);
          onChange(parsed);
        } else if (text) {
          setInvalid(true);
          onChange("");
        }
        onBlur?.(e);
      }}
    />
  );
}

/** `className` styles the wrapper (layout); `inputClassName` the text field itself. */
export function DateInput({
  value,
  onChange,
  className = "",
  inputClassName = "",
  onBlur,
  ...props
}: FieldProps & { inputClassName?: string }) {
  const [text, setText] = useState(isoToDisplayDate(value ?? ""));
  const [invalid, setInvalid] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((parseDate(text) ?? "") !== (value ?? "")) {
      setText(isoToDisplayDate(value ?? ""));
      setInvalid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={props.placeholder ?? "dd/mm/åååå"}
        maxLength={10}
        aria-invalid={invalid || undefined}
        className={`${inputClass} pr-10 tabular-nums ${invalid ? "border-danger!" : ""} ${inputClassName}`}
        value={text}
        onChange={(e) => {
          const masked = maskDate(e.target.value);
          setText(masked);
          setInvalid(false);
          if (masked === "") onChange("");
          else if (masked.length === 10) onChange(parseDate(masked) ?? "");
        }}
        onBlur={(e) => {
          const parsed = parseDate(text);
          if (parsed) onChange(parsed);
          else if (text) {
            setInvalid(true);
            onChange("");
          }
          onBlur?.(e);
        }}
      />
      {/* Calendar button: opens the device's own date picker; the result is shown as dd/mm/åååå. */}
      <button
        type="button"
        aria-label="Vælg dato i kalender"
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-fg"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
        value={value ?? ""}
        onChange={(e) => {
          setText(isoToDisplayDate(e.target.value));
          setInvalid(false);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}
