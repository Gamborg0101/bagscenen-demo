"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/styles";
import { inviteHelpers } from "../actions";

export function InvitePicker({ eventId, candidates }: { eventId: string; candidates: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();

  if (candidates.length === 0) return <p className="text-xs text-muted">Alle aktive medhjælpere er inviteret.</p>;

  if (!open) {
    return (
      <div className="space-y-1">
        <button type="button" className={buttonClass("primary")} onClick={() => setOpen(true)}>
          Invitér medhjælpere
        </button>
        {message.ok && <p className="text-xs text-ok">{message.ok}</p>}
      </div>
    );
  }

  const all = selected.length === candidates.length;
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between">
        <p className="font-medium">Hvem skal inviteres?</p>
        <button type="button" className="text-xs underline" onClick={() => setSelected(all ? [] : candidates.map((c) => c.id))}>
          {all ? "Fravælg alle" : "Vælg alle"}
        </button>
      </div>
      <ul className="grid gap-x-4 sm:grid-cols-2">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-2.5 py-1">
              <input
                type="checkbox"
                className="size-4 accent-current"
                checked={selected.includes(c.id)}
                onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))}
              />
              {c.name}
            </label>
          </li>
        ))}
      </ul>
      {message.error && <p className="text-xs text-danger">{message.error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className={buttonClass("primary")}
          disabled={pending || selected.length === 0}
          onClick={() =>
            start(async () => {
              const res = await inviteHelpers(eventId, selected);
              if (res.error) return setMessage({ error: res.error });
              setMessage({ ok: `${res.count} inviteret. De kan se arrangementet, når de logger ind.` });
              setSelected([]);
              setOpen(false);
            })
          }
        >
          {pending ? "Inviterer …" : `Invitér ${selected.length || ""}`.trim()}
        </button>
        <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>
          Annullér
        </button>
      </div>
    </div>
  );
}

