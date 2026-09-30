"use client";

import { buttonClass } from "./styles";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className={buttonClass("secondary")} onClick={() => window.print()}>
      {label}
    </button>
  );
}
