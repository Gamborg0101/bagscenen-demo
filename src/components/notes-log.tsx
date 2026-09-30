"use client";

import { useState, useTransition } from "react";
import { addNote, deleteNote } from "@/app/(app)/arrangementer/actions";
import { TextArea } from "./form-controls";
import { buttonClass } from "./styles";

export type NoteView = { id: string; author: string; when: string; body: string; canDelete: boolean };

/** Shared "Aftaler & noter" log: helpers record agreements, the coordinator follows along. */
export function NotesLog({ eventId, notes, canWrite }: { eventId: string; notes: NoteView[]; canWrite: boolean }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <section className="border-t border-line pt-5">
      <h2 className="mb-1 text-sm font-semibold tracking-wide uppercase">Aftaler & noter</h2>
      <p className="mb-3 text-xs text-muted">Skriv det ned, når I aftaler noget med arrangøren — så kan alle følge med.</p>


      {canWrite && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            start(async () => {
              const res = await addNote(eventId, body);
              if (res.error) setError(res.error);
              else setBody("");
            });
          }}
        >
          <TextArea aria-label="Ny note" placeholder="Fx: Aftalt med arrangøren, at scenen skal stå klar kl. 14" value={body} onChange={setBody} />
          {error && <p className="text-xs text-danger">{error}</p>}
          <button className={buttonClass("secondary")} disabled={pending || !body.trim()}>
            {pending ? "Gemmer …" : "Tilføj note"}
          </button>
        </form>
      )}

      {notes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-line pl-3">
              <p className="text-xs text-muted">
                <span className="font-medium text-fg">{n.author}</span> · {n.when}
                {n.canDelete && (
                  <button
                    type="button"
                    className="ml-2 hover:text-danger"
                    disabled={pending}
                    onClick={() => start(async () => void (await deleteNote(n.id)))}
                  >
                    Slet
                  </button>
                )}
              </p>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
