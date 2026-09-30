// Plain class-name helpers, usable from both server and client components.

export const inputClass =
  "block w-full rounded-md border border-line bg-field px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none";

export function buttonClass(variant: "primary" | "secondary" | "danger" = "primary", size: "md" | "sm" = "md") {
  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";
  const base = `inline-flex items-center justify-center rounded-md ${pad} font-medium transition-colors disabled:opacity-50`;
  switch (variant) {
    case "primary":
      return `${base} bg-fg text-bg hover:opacity-85`;
    case "secondary":
      return `${base} border border-line text-fg hover:bg-subtle`;
    case "danger":
      return `${base} border border-line text-danger hover:bg-subtle`;
  }
}
