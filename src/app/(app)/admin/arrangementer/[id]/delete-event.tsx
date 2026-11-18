"use client";

import { useState } from "react";
import { buttonClass } from "@/components/styles";
import { deleteEvent } from "../actions";

/** Two-step delete, so a real event isn't removed by a stray tap. */
export function DeleteEvent({ eventId, title, isDraft, helperCount }: { eventId: string; title: string; isDraft: boolean; helperCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const label = isDraft ? "Slet kladde" : "Slet arrangement";

  return (
    <div className="border-t border-line pt-6">
      {confirming ? (
        <form action={deleteEvent} className="space-y-3">
          <input type="hidden" name="eventId" value={eventId} />
          <p className="text-danger">
            Slet “{title}” for altid?
            {helperCount > 0 && ` ${helperCount} ${helperCount === 1 ? "medhjælpers svar" : "medhjælperes svar"} slettes også.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass("danger")}>Ja, slet</button>
            <button type="button" className={buttonClass("secondary")} onClick={() => setConfirming(false)}>
              Annullér
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={buttonClass("danger")} onClick={() => setConfirming(true)}>
          {label}
        </button>
      )}
    </div>
  );
}
