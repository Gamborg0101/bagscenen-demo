"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TECHRIDER_MAX_BYTES, formatBytes } from "@/lib/techrider";
import { buttonClass } from "./styles";

type Props = {
  url: string; // /arrangementer/<id>/kanalplan/<planId>/techrider
  file: { filename: string; size: number; uploadedAt: string } | null;
  canEdit: boolean;
};

/** Attach, download or remove the band's techrider (PDF). */
export function TechRiderPanel({ url, file, canEdit }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function send(init: RequestInit) {
    setError(undefined);
    start(async () => {
      const res = await fetch(url, init).catch(() => null);
      const body = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) return setError(body.error ?? "Noget gik galt. Prøv igen.");
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  function upload(f: File) {
    if (f.size > TECHRIDER_MAX_BYTES) return setError("Filen er for stor (max 4 MB).");
    const data = new FormData();
    data.append("file", f);
    send({ method: "POST", body: data });
  }

  if (!file && !canEdit) return null;

  return (
    <section className="space-y-2 print:hidden">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Techrider</h2>
      {file ? (
        <div className="flex flex-wrap items-center gap-3">
          <a href={url} className={buttonClass("secondary", "sm")} download>
            Download PDF
          </a>
          <span className="min-w-0 text-xs text-muted">
            <span className="break-all text-fg">{file.filename}</span> · {formatBytes(file.size)}
          </span>
          {canEdit && (
            <button type="button" disabled={pending} className="text-xs text-muted hover:text-danger" onClick={() => send({ method: "DELETE" })}>
              Fjern
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">Ingen techrider endnu.</p>
      )}
      {canEdit && (
        <label className="block">
          <span className="sr-only">{file ? "Erstat techrider" : "Upload techrider"}</span>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            disabled={pending}
            className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-field file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-fg hover:file:bg-subtle"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
      )}
      {pending && <p className="text-xs text-muted">Arbejder …</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">Kun PDF, max 4 MB. Kan kun hentes af folk på arrangementet — ikke via QR-linket.</p>
    </section>
  );
}
