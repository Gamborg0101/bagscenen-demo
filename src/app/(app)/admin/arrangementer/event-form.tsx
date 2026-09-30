"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EventType, LightingPreset, ShiftKind } from "@prisma/client";
import { DateInput, TimeInput } from "@/components/date-time-inputs";
import { Chips, Label, NumberInput, Segmented, Stepper, TextArea, TextInput, Toggle } from "@/components/form-controls";
import { buttonClass, inputClass } from "@/components/styles";
import { addDays } from "@/lib/datetime";
import {
  RAILING_ABOVE_CM,
  ROOMS,
  VENUE_CAPACITY,
  anchorIsDeadline,
  capacityMessage,
  emptyEventForm,
  formatDuration,
  roomHasFoyerOption,
  standardShifts,
  syncShiftsToEvent,
  type EventFormInput,
  type SectionKey,
  type ShiftFormRow,
} from "@/lib/events/form";
import { EVENT_TYPE_LABEL, LIGHTING_LABEL, SHIFT_KIND_LABEL } from "@/lib/events/labels";
import { saveEvent, type SaveEventResult } from "./actions";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "stage", label: "Scene / podier" },
  { key: "av", label: "Projektor / lyd fra computer" },
  { key: "sound", label: "Lyd" },
  { key: "light", label: "Lys" },
  { key: "furniture", label: "Stole / borde" },
  { key: "other", label: "Andet" },
];

const FIELD_LABEL: Record<string, string> = {
  title: "Titel",
  date: "Dato",
  startTime: "Starttid",
  endTime: "Sluttid",
  expectedAttendees: "Antal deltagere",
  chairs: "Stole",
  contacts: "Kontaktperson",
  shifts: "Vagter",
};

const DURATIONS = [30, 60, 90, 120, 180] as const;
const PEOPLE_CHIPS = [40, 80, 100, 120, VENUE_CAPACITY] as const;

type Props = { eventId: string | null; requestId?: string; initial: EventFormInput | null };

export function EventForm({ eventId, requestId, initial }: Props) {
  const router = useRouter();
  const [f, setF] = useState<EventFormInput>(initial ?? emptyEventForm());
  const [result, setResult] = useState<SaveEventResult>({});
  const [pending, startTransition] = useTransition();

  function set<K extends keyof EventFormInput>(key: K, value: EventFormInput[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  // Changing the event date moves the shifts along by the same number of days.
  function setDate(date: string) {
    setF((prev) => {
      const delta = prev.date && date ? daysBetween(prev.date, date) : 0;
      const shifts = prev.shifts.map((s) => ({ ...s, date: !s.date ? date : delta ? addDays(s.date, delta) : s.date }));
      return { ...prev, date, shifts };
    });
  }

  // Changing the event's start/end moves the shifts that are tied to them.
  function setTimes(patch: { startTime?: string; endTime?: string | null }) {
    setF((prev) => {
      const next = { startTime: patch.startTime ?? prev.startTime, endTime: patch.endTime !== undefined ? patch.endTime : prev.endTime };
      return { ...prev, ...next, shifts: syncShiftsToEvent(prev.shifts, prev, next) };
    });
  }

  function toggleSection(key: SectionKey) {
    set("sections", { ...f.sections, [key]: !f.sections[key] });
  }

  function updateRow<K extends "contacts" | "shifts">(key: K, index: number, patch: Partial<EventFormInput[K][number]>) {
    const rows = [...f[key]] as EventFormInput[K][number][];
    rows[index] = { ...rows[index], ...patch };
    set(key, rows as EventFormInput[K]);
  }

  function removeRow(key: "contacts" | "shifts", index: number) {
    set(key, f[key].filter((_, i) => i !== index) as never);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      let res: SaveEventResult;
      try {
        res = await saveEvent(eventId, f, requestId);
      } catch {
        res = { error: "Der skete en fejl. Prøv igen — dine ændringer er ikke tabt." };
      }
      if (res.id) return router.push(`/admin/arrangementer/${res.id}`);
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const issueFor = (path: string) => result.issues?.find((i) => i.path === path)?.message;

  return (
    <form onSubmit={submit} className="space-y-8 pb-24">
      {result.error && (
        <div className="rounded-md border border-danger/40 p-3 text-danger">
          <p className="font-medium">{result.error}</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {result.issues?.map((i) => (
              <li key={i.path}>
                {FIELD_LABEL[i.path.split(".")[0]] ?? i.path}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Basics ---------- */}
      <Block title="Arrangement">
        <div>
          <Label htmlFor="title">Titel</Label>
          <TextInput id="title" value={f.title} onChange={(v) => set("title", v)} placeholder="Fx Semesterstart" required />
          <FieldError msg={issueFor("title")} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="date">Dato</Label>
            <DateInput id="date" value={f.date} onChange={(v) => setDate(v)} required />
          </div>
          <div>
            <Label htmlFor="start">Start</Label>
            <TimeInput id="start" value={f.startTime} onChange={(v) => setTimes({ startTime: v })} required />
          </div>
          <div>
            <Label htmlFor="end">Slut</Label>
            <TimeInput id="end" value={f.endTime ?? ""} onChange={(v) => setTimes({ endTime: v || null })} />
          </div>
        </div>
        <div>
          <Label>Lokale</Label>
          <Segmented label="Lokale" value={f.location as (typeof ROOMS)[number]} onChange={(v) => set("location", v)} options={ROOMS.map((r) => ({ value: r, label: r }))} />
          {roomHasFoyerOption(f.location) && (
            <div className="mt-3 space-y-2">
              <Toggle label="Bruger også foyeren" checked={f.foyerUsed} onChange={(v) => set("foyerUsed", v)} />
              {f.foyerUsed && (
                <Panel title="Foyer">
                  <div className="divide-y divide-line">
                    <Stepper label="Podier" value={f.foyerPodiums} onChange={(v) => set("foyerPodiums", v)} />
                    {f.foyerPodiums > 0 && (
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        <div>
                          <Label htmlFor="foyerPodiumSize">Størrelse (m)</Label>
                          <TextInput id="foyerPodiumSize" value={f.foyerPodiumSize ?? ""} onChange={(v) => set("foyerPodiumSize", v)} placeholder="Fx 2x2" />
                          <Chips options={["2x1", "2x2", "3x3"] as const} value={f.foyerPodiumSize as never} onPick={(v) => set("foyerPodiumSize", v)} />
                        </div>
                        <div>
                          <Label htmlFor="foyerPodiumHeight">Højde (cm)</Label>
                          <NumberInput id="foyerPodiumHeight" value={f.foyerPodiumHeightCm} onChange={(v) => set("foyerPodiumHeightCm", v)} />
                          <Chips options={[20, 40, 60] as const} value={f.foyerPodiumHeightCm as never} onPick={(v) => set("foyerPodiumHeightCm", v)} />
                          {(f.foyerPodiumHeightCm ?? 0) > RAILING_ABOVE_CM && (
                            <p className="mt-1.5 text-xs font-semibold text-danger">HUSK SIDERÆLING — påkrævet over {RAILING_ABOVE_CM} cm.</p>
                          )}
                        </div>
                      </div>
                    )}
                    <Stepper label="Mikrofoner" value={f.foyerMics} onChange={(v) => set("foyerMics", v)} />
                    <Stepper label="Letvægtsborde" value={f.foyerTables} onChange={(v) => set("foyerTables", v)} />
                  </div>
                  <Toggle label="Skal bruge lyd fra anlægget" checked={f.foyerSound} onChange={(v) => set("foyerSound", v)} />
                </Panel>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="type">Type</Label>
            <select id="type" className={inputClass} value={f.eventType} onChange={(e) => set("eventType", e.target.value as EventType)}>
              {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="attendees">Antal deltagere (max {VENUE_CAPACITY})</Label>
            <NumberInput id="attendees" max={VENUE_CAPACITY} value={f.expectedAttendees} onChange={(v) => set("expectedAttendees", v)} />
            <Chips options={PEOPLE_CHIPS} value={f.expectedAttendees as never} onPick={(v) => set("expectedAttendees", v)} />
            <CapacityWarning value={f.expectedAttendees} />
          </div>
          <div>
            <Label htmlFor="helpers">Medhjælpere ønsket</Label>
            <NumberInput id="helpers" value={f.helpersWanted} onChange={(v) => set("helpersWanted", v)} />
            <Chips options={[1, 2, 3, 4] as const} value={f.helpersWanted as never} onPick={(v) => set("helpersWanted", v)} />
          </div>
        </div>
      </Block>

      {/* ---------- Contacts ---------- */}
      <Block title="Kontaktpersoner" hint="Medhjælperne kontakter dem direkte for at koordinere.">
        {f.contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-line p-3">
            <TextInput aria-label="Navn" placeholder="Navn" value={c.name} onChange={(v) => updateRow("contacts", i, { name: v })} />
            <TextInput aria-label="Rolle" placeholder="Rolle, fx arrangør" value={c.role} onChange={(v) => updateRow("contacts", i, { role: v })} />
            <TextInput aria-label="Telefon" type="tel" placeholder="Telefon (valgfri)" value={c.phone} onChange={(v) => updateRow("contacts", i, { phone: v })} />
            <TextInput aria-label="E-mail" type="email" placeholder="E-mail (valgfri)" value={c.email} onChange={(v) => updateRow("contacts", i, { email: v })} />
            <RemoveButton className="col-span-2 justify-self-end" onClick={() => removeRow("contacts", i)} />
          </div>
        ))}
        <AddButton onClick={() => set("contacts", [...f.contacts, { name: "", role: "", email: "", phone: "" }])}>Tilføj kontaktperson</AddButton>
      </Block>

      {/* ---------- Requirements ---------- */}
      <Block title="Hvad skal der bruges?" hint="Vælg de områder, der er relevante.">
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={f.sections[s.key]}
              onClick={() => toggleSection(s.key)}
              className={`rounded-full border px-3 py-1 text-xs ${f.sections[s.key] ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {f.sections.stage && (
          <Panel title="Scene / podier">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="stageSize">Scenestørrelse (m)</Label>
                <TextInput id="stageSize" value={f.stageSize} onChange={(v) => set("stageSize", v)} placeholder="Fx 3x3" />
                <Chips options={["2x2", "3x3", "4x3", "6x4"] as const} value={f.stageSize as never} onPick={(v) => set("stageSize", v)} />
              </div>
              <div>
                <Label htmlFor="podiumHeight">Ben højde (cm)</Label>
                <NumberInput id="podiumHeight" value={f.podiumHeightCm} onChange={(v) => set("podiumHeightCm", v)} />
                <Chips options={[20, 40, 60] as const} value={f.podiumHeightCm as never} onPick={(v) => set("podiumHeightCm", v)} />
                {(f.podiumHeightCm ?? 0) > RAILING_ABOVE_CM && (
                  <p className="mt-1.5 text-xs font-semibold text-danger">HUSK SIDERÆLING — påkrævet over {RAILING_ABOVE_CM} cm.</p>
                )}
              </div>
            </div>
            <Toggle label="Talerstol" checked={f.lectern} onChange={(v) => set("lectern", v)} />
            <TextArea aria-label="Noter om scene" placeholder="Noter, fx bord med 4 stole på scenen" value={f.stageNotes} onChange={(v) => set("stageNotes", v)} />
          </Panel>
        )}

        {f.sections.av && (
          <Panel title="Projektor / lyd fra computer">
            <Toggle label="Projektor" checked={f.projector} onChange={(v) => set("projector", v)} />
            <Toggle label="Lyd fra computer" hint="Præsentation, film eller musik" checked={f.pcAudio} onChange={(v) => set("pcAudio", v)} />
          </Panel>
        )}

        {f.sections.sound && (
          <Panel title="Lyd">
            <div className="divide-y divide-line">
              <Stepper label="Håndholdte mikrofoner" value={f.handheldMics} onChange={(v) => set("handheldMics", v)} />
              <Stepper label="Headset / beltpack" value={f.headsetMics} onChange={(v) => set("headsetMics", v)} />
            </div>
            <TextInput
              aria-label="Noter om mikrofoner"
              placeholder="Noter"
              value={f.micPurpose}
              onChange={(v) => set("micPurpose", v)}
            />
            <Toggle label="Der kommer bands" checked={f.bands} onChange={(v) => set("bands", v)} />
            {f.bands && (
              <div className="space-y-3 border-l border-line pl-3">
                <div className="w-32">
                  <Label htmlFor="bandCount">Antal bands</Label>
                  <NumberInput id="bandCount" value={f.bandCount} onChange={(v) => set("bandCount", v)} />
                </div>
              </div>
            )}
            <TextArea aria-label="Noter om lyd" placeholder="Andre noter om lyd" value={f.soundNotes} onChange={(v) => set("soundNotes", v)} />
          </Panel>
        )}

        {f.sections.light && (
          <Panel title="Lys">
            <Segmented
              label="Lysopsætning"
              value={f.lightingPreset}
              onChange={(v) => set("lightingPreset", v)}
              options={(Object.keys(LIGHTING_LABEL) as LightingPreset[]).map((v) => ({ value: v, label: LIGHTING_LABEL[v] }))}
            />
            <TextArea aria-label="Noter om lys" placeholder="Stemning, særlige ønsker" value={f.lightingNotes} onChange={(v) => set("lightingNotes", v)} />
          </Panel>
        )}

        {f.sections.furniture && (
          <Panel title="Stole / borde">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="chairs">Stole (max {VENUE_CAPACITY})</Label>
                <NumberInput id="chairs" max={VENUE_CAPACITY} value={f.chairs} onChange={(v) => set("chairs", v)} />
                <Chips options={PEOPLE_CHIPS} value={f.chairs as never} onPick={(v) => set("chairs", v)} />
                <CapacityWarning value={f.chairs} />
              </div>
              <div>
                <Label htmlFor="tables">Borde</Label>
                <NumberInput id="tables" value={f.tables} onChange={(v) => set("tables", v)} />
                <Chips options={[2, 4, 6] as const} value={f.tables as never} onPick={(v) => set("tables", v)} />
              </div>
            </div>
            <TextArea
              aria-label="Andet møblement"
              placeholder="Andet, fx borde til studiebrug, lille bord til computer"
              value={f.otherFurniture}
              onChange={(v) => set("otherFurniture", v)}
            />
          </Panel>
        )}

        {f.sections.other && (
          <Panel title="Andet">
            <TextArea aria-label="Andre behov" placeholder="Andre behov til arrangementet" value={f.extraNotes} onChange={(v) => set("extraNotes", v)} />
          </Panel>
        )}
      </Block>

      {/* ---------- Shifts ---------- */}
      <Block
        title="Vagter"
        hint="Fast tid, eller en varighed hvor medhjælperne selv vælger hvornår de starter. Medhjælperne opfordres til at tage hele vagter."
      >
        {f.shifts.map((s, i) => (
          <ShiftRow key={i} row={s} onChange={(patch) => updateRow("shifts", i, patch)} onRemove={() => removeRow("shifts", i)} />
        ))}
        <div className="flex flex-wrap gap-2">
          {f.shifts.length === 0 && (
            <button
              type="button"
              className={buttonClass("primary")}
              disabled={!f.date || !f.startTime}
              title={!f.date || !f.startTime ? "Udfyld dato og starttid først" : undefined}
              onClick={() => set("shifts", standardShifts(f.date, f.startTime, f.endTime))}
            >
              Standardvagter
            </button>
          )}
          <AddButton
            onClick={() =>
              set("shifts", [
                ...f.shifts,
                { id: null, kind: "ANDET", label: "", date: f.date, mode: "FIXED", start: f.startTime, end: null, durationMinutes: null, notes: "" },
              ])
            }
          >
            Tilføj vagt
          </AddButton>
        </div>
        {f.shifts.length === 0 && (
          <p className="text-xs text-muted">Standardvagter: opsætning (ca. 2 t, klar til start), arrangement og nedtagning (ca. 2 t efter slut). De følger start og slut, hvis du ændrer dem.</p>
        )}
      </Block>

      <Block title="Generelle noter">
        <TextArea aria-label="Generelle noter" rows={5} placeholder="Alt det andet fra mødet …" value={f.generalNotes} onChange={(v) => set("generalNotes", v)} />
      </Block>

      {/* ---------- Save bar ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Segmented
            label="Status"
            value={f.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "DRAFT", label: "Kladde" },
              { value: "PUBLISHED", label: "Klar" },
              ...(eventId ? [{ value: "CANCELLED" as const, label: "Aflyst" }] : []),
            ]}
          />
          <button type="submit" disabled={pending} className={`${buttonClass("primary")} ml-auto min-w-24`}>
            {pending ? "Gemmer …" : "Gem"}
          </button>
        </div>
      </div>
    </form>
  );
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function CapacityWarning({ value }: { value: number | null }) {
  if (value == null || value <= VENUE_CAPACITY) return null;
  return <p className="mt-1.5 text-xs text-danger">{capacityMessage}.</p>;
}

function ShiftRow({ row, onChange, onRemove }: { row: ShiftFormRow; onChange: (p: Partial<ShiftFormRow>) => void; onRemove: () => void }) {
  const [more, setMore] = useState(!!row.label || !!row.notes);
  const duration = row.mode === "DURATION";
  const anchorLabel = anchorIsDeadline(row.kind) ? "Klar senest kl." : "Fra kl.";

  return (
    <div className="space-y-3 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Vagttype" className={`${inputClass} w-auto! font-medium`} value={row.kind} onChange={(e) => onChange({ kind: e.target.value as ShiftKind })}>
          {(Object.keys(SHIFT_KIND_LABEL) as ShiftKind[]).map((k) => (
            <option key={k} value={k}>
              {SHIFT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <Segmented
          label="Tidstype"
          value={row.mode}
          onChange={(mode) => onChange({ mode, durationMinutes: mode === "DURATION" ? (row.durationMinutes ?? 60) : null })}
          options={[
            { value: "FIXED", label: "Fast tid" },
            { value: "DURATION", label: "Varighed" },
          ]}
        />
        <div className="ml-auto">
          <RemoveButton onClick={onRemove} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <Label>Dato</Label>
          <DateInput aria-label="Dato" value={row.date} onChange={(v) => onChange({ date: v })} />
        </div>
        <div>
          <Label>{duration ? anchorLabel : "Fra"}</Label>
          <TimeInput aria-label={duration ? anchorLabel : "Fra"} value={row.start} onChange={(v) => onChange({ start: v })} />
        </div>
        {!duration && (
          <div>
            <Label>Til</Label>
            <TimeInput aria-label="Til" value={row.end ?? ""} onChange={(v) => onChange({ end: v || null })} />
          </div>
        )}
      </div>

      {duration ? (
        <div>
          <Label>Tager ca.</Label>
          <Chips options={DURATIONS} value={row.durationMinutes as never} onPick={(v) => onChange({ durationMinutes: v })} format={formatDuration} />
          <p className="mt-1.5 text-xs text-muted">Medhjælperne vælger selv, hvornår de starter.</p>
        </div>
      ) : (
        !row.end && <p className="-mt-1 text-xs text-muted">Uden sluttid = indtil færdig.</p>
      )}
      {more ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextInput aria-label="Navn på vagt" placeholder="Navn, fx Reception i foyeren" value={row.label} onChange={(v) => onChange({ label: v })} />
          <TextInput aria-label="Note til vagt" placeholder="Note" value={row.notes} onChange={(v) => onChange({ notes: v })} />
        </div>
      ) : (
        <button type="button" className="text-xs text-muted underline" onClick={() => setMore(true)}>
          Tilføj navn / note
        </button>
      )}
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-md border border-line p-3">
      <legend className="px-1 text-xs font-medium text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={buttonClass("secondary")}>
      + {children}
    </button>
  );
}

function RemoveButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`text-xs text-muted hover:text-danger ${className}`}>
      Fjern
    </button>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-danger">{msg}</p> : null;
}
