"use client";

import { useState, useTransition } from "react";
import type { InvitationStatus } from "@prisma/client";
import { DateInput, TimeInput } from "@/components/date-time-inputs";
import { buttonClass } from "@/components/styles";
import type { ResponseInput } from "@/lib/events/response";
import { respondToEvent, setHelperAnswer } from "../actions";

/** A shift as the helper sees it. Duration shifts come with a suggested start. */
export type ShiftOption = {
  id: string;
  name: string;
  time: string;
  duration: string | null; // e.g. "2 t" for duration shifts
  suggestedDate: string;
  suggestedStart: string;
};
type Pick = { id: string; date: string | null; start: string | null };
type WindowRow = ResponseInput["windows"][number];

type Props = {
  eventId: string;
  eventDay: string;
  multiDay: boolean;
  shifts: ShiftOption[];
  status: InvitationStatus;
  summary: string[];
  initial: { picks: Pick[]; windows: WindowRow[] };
  locked: boolean;
  cancelled: boolean;
  /** Coordinator mode: edit or cancel this helper's shifts on their behalf. */
  admin?: { invitationId: string; name: string };
};

export function ResponseForm(p: Props) {
  const [editing, setEditing] = useState(false);
  const [picks, setPicks] = useState<Pick[]>(p.initial.picks);
  const [windows, setWindows] = useState<WindowRow[]>(p.initial.windows);
  const [showWindows, setShowWindows] = useState(p.initial.windows.length > 0);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function send(status: "ACCEPTED" | "DECLINED") {
    setError(undefined);
    start(async () => {
      const answer = {
        status,
        shifts: status === "ACCEPTED" ? picks : [],
        windows: status === "ACCEPTED" ? windows.filter((w) => w.start) : [],
      };
      const res = p.admin ? await setHelperAnswer(p.admin.invitationId, answer) : await respondToEvent(p.eventId, answer);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function togglePick(s: ShiftOption, on: boolean) {
    setPicks(
      on
        ? [...picks, { id: s.id, date: s.duration ? s.suggestedDate : null, start: s.duration ? s.suggestedStart : null }]
        : picks.filter((x) => x.id !== s.id),
    );
  }

  const box = "rounded-lg border border-line p-4";

  if (p.locked || (p.cancelled && p.status !== "ACCEPTED")) {
    return <StatusLine status={p.status} summary={p.summary} />;
  }

  // ---------- Choosing shifts ----------
  if (editing) {
    return (
      <div className={`${box} space-y-4`}>
        <div>
          <p className="font-medium">{p.admin ? `Hvilke vagter tager ${p.admin.name}?` : "Hvilke vagter tager du?"}</p>
          <p className="text-xs text-muted">Tag gerne hele vagter — det gør det nemmere for alle.</p>
        </div>

        {p.shifts.length > 0 && (
          <ul className="space-y-1">
            {p.shifts.map((s) => {
              const pick = picks.find((x) => x.id === s.id);
              return (
                <li key={s.id} className="rounded-md px-1 py-1.5 hover:bg-subtle">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" className="size-4 accent-current" checked={!!pick} onChange={(e) => togglePick(s, e.target.checked)} />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-right text-muted tabular-nums">{s.time}</span>
                  </label>
                  {pick && s.duration && (
                    <div className="mt-2 ml-7 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted">Jeg starter kl.</span>
                      {p.multiDay && (
                        <DateInput
                          aria-label={`Dato for ${s.name}`}
                          className="w-40!"
                          value={pick.date ?? ""}
                          onChange={(v) => setPicks(picks.map((x) => (x.id === s.id ? { ...x, date: v } : x)))}
                        />
                      )}
                      <TimeInput
                        aria-label={`Starttid for ${s.name}`}
                        className="w-24!"
                        value={pick.start ?? ""}
                        onChange={(v) => setPicks(picks.map((x) => (x.id === s.id ? { ...x, start: v } : x)))}
                      />
                      <span className="text-muted">og bruger ca. {s.duration}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {showWindows || p.shifts.length === 0 ? (
          <div className="space-y-2 border-l border-line pl-3">
            <p className="text-xs text-muted">Kan du kun en del af tiden? Skriv hvornår — og gerne hvorfor i noten.</p>
            {windows.map((w, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                {p.multiDay && (
                  <DateInput
                    aria-label="Dato"
                    className="col-span-4"
                    value={w.date}
                    onChange={(v) => setWindows(windows.map((x, j) => (j === i ? { ...x, date: v } : x)))}
                  />
                )}
                <TimeInput
                  aria-label="Fra"
                  value={w.start}
                  onChange={(v) => setWindows(windows.map((x, j) => (j === i ? { ...x, start: v } : x)))}
                />
                <span className="text-muted">–</span>
                <TimeInput
                  aria-label="Til"
                  value={w.end ?? ""}
                  onChange={(v) => setWindows(windows.map((x, j) => (j === i ? { ...x, end: v || null } : x)))}
                />
                <button
                  type="button"
                  aria-label="Fjern tidsrum"
                  className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-danger"
                  onClick={() => setWindows(windows.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="text-xs underline underline-offset-2" onClick={() => setWindows([...windows, { date: p.eventDay, start: "", end: null }])}>
              + Eget tidsrum
            </button>
          </div>
        ) : (
          <button type="button" className="text-xs text-muted underline underline-offset-2" onClick={() => setShowWindows(true)}>
            Kan du ikke tage en hel vagt?
          </button>
        )}


        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={buttonClass("primary")} disabled={pending} onClick={() => send("ACCEPTED")}>
            {pending ? "Sender …" : "Send svar"}
          </button>
          <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={() => setEditing(false)}>
            Annullér
          </button>
        </div>
      </div>
    );
  }

  // ---------- Coordinator: compact actions on the helper's row ----------
  if (p.admin) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass("secondary", "sm")} disabled={pending} onClick={() => setEditing(true)}>
          Ret vagter
        </button>
        {p.status !== "DECLINED" && (
          <button type="button" className={buttonClass("danger", "sm")} disabled={pending} onClick={() => send("DECLINED")}>
            Meld fra
          </button>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  // ---------- Helper: answer once; after "yes" only the coordinator can change it ----------
  return (
    <div className={`${box} space-y-3`}>
      {p.status === "PENDING" ? <p className="font-medium">Kan du hjælpe til dette arrangement?</p> : <StatusLine status={p.status} summary={p.summary} />}
      {error && <p className="text-xs text-danger">{error}</p>}
      {p.status === "ACCEPTED" ? (
        <p className="text-xs text-muted">Kan du ikke alligevel, eller skal noget ændres? Kontakt koordinatoren.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("primary")} disabled={pending} onClick={() => setEditing(true)}>
            {p.status === "DECLINED" ? "Ja, jeg kan alligevel" : "Ja, jeg kan"}
          </button>
          {p.status === "PENDING" && (
            <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={() => send("DECLINED")}>
              Nej, jeg kan ikke
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusLine({ status, summary }: { status: InvitationStatus; summary: string[] }) {
  if (status === "ACCEPTED") {
    return (
      <div>
        <p className="font-medium text-ok">Du er på</p>
        <ul className="text-sm tabular-nums">
          {summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (status === "DECLINED") return <p className="text-muted">Du har meldt fra. Du kan stadig se arrangementet.</p>;
  return <p className="text-muted">Du har ikke svaret.</p>;
}
