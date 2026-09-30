"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { DateInput, TimeInput } from "@/components/date-time-inputs";
import { Label, NumberInput, Stepper, TextArea, TextInput, Toggle } from "@/components/form-controls";
import { buttonClass, inputClass } from "@/components/styles";
import { ROOMS, roomHasFoyerOption } from "@/lib/events/form";
import { emptyIntake, type IntakeInput } from "@/lib/events/intake";
import { submitIntake, type IntakeResult } from "../actions";
import { t, type Lang } from "../i18n";

export function IntakeForm({ token, lang }: { token: string; lang: Lang }) {
  const tx = t[lang];
  const [f, setF] = useState<IntakeInput>(emptyIntake());
  const [honeypot, setHoneypot] = useState("");
  const [bad, setBad] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "done" | "invalid" | "required" | "error">("idle");
  const [pending, start] = useTransition();

  const set = <K extends keyof IntakeInput>(k: K, v: IntakeInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const mark = (k: string) => (bad.includes(k) ? "border-danger!" : "");

  if (status === "done") {
    return (
      <div className="space-y-2 rounded-lg border border-line p-4">
        <p className="font-medium text-ok">{tx.thanks}</p>
        <p className="text-muted">{tx.thanksBody}</p>
      </div>
    );
  }
  if (status === "invalid") return <p className="text-muted">{tx.invalid}</p>;

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res: IntakeResult = await submitIntake(token, f, honeypot).catch(() => ({ error: "error" }));
          if (res.ok) return setStatus("done");
          setBad(res.fields ?? []);
          setStatus(res.error ?? "error");
          if (res.error === "required") window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }}
    >
      {status === "required" && <p className="rounded-md border border-danger/40 p-3 text-danger">{tx.required}</p>}
      {status === "error" && <p className="rounded-md border border-danger/40 p-3 text-danger">{tx.error}</p>}

      {/* Honeypot: hidden from people and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>

      <Block title={tx.contact} hint={tx.contactHint}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cn">{tx.name} *</Label>
            <TextInput id="cn" autoComplete="name" className={`${inputClass} ${mark("contactName")}`} value={f.contactName} onChange={(v) => set("contactName", v)} required />
          </div>
          <div>
            <Label htmlFor="ce">{tx.email} *</Label>
            <TextInput id="ce" type="email" autoComplete="email" className={`${inputClass} ${mark("contactEmail")}`} value={f.contactEmail} onChange={(v) => set("contactEmail", v)} required />
          </div>
          <div>
            <Label htmlFor="cp">{tx.phone}</Label>
            <TextInput id="cp" type="tel" autoComplete="tel" value={f.contactPhone} onChange={(v) => set("contactPhone", v)} />
          </div>
          <div>
            <Label htmlFor="dep">{tx.department}</Label>
            <TextInput id="dep" autoComplete="organization" value={f.department} onChange={(v) => set("department", v)} />
          </div>
        </div>
      </Block>

      <Block title={tx.event}>
        <div>
          <Label htmlFor="ti">{tx.eventTitle} *</Label>
          <TextInput id="ti" className={`${inputClass} ${mark("title")}`} value={f.title} onChange={(v) => set("title", v)} required />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="da">{tx.date} *</Label>
            <DateInput id="da" inputClassName={mark("date")} value={f.date} onChange={(v) => set("date", v)} required />
          </div>
          <div>
            <Label htmlFor="st">{tx.start} *</Label>
            <TimeInput id="st" className={mark("startTime")} value={f.startTime} onChange={(v) => set("startTime", v)} required />
          </div>
          <div>
            <Label htmlFor="en">{tx.end}</Label>
            <TimeInput id="en" value={f.endTime ?? ""} onChange={(v) => set("endTime", v || null)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="ty">{tx.type}</Label>
            <select id="ty" className={inputClass} value={f.eventType} onChange={(e) => set("eventType", e.target.value as IntakeInput["eventType"])}>
              {(Object.keys(tx.types) as (keyof typeof tx.types)[]).map((k) => (
                <option key={k} value={k}>
                  {tx.types[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="lo">{tx.location}</Label>
          <select id="lo" className={inputClass} value={f.location} onChange={(e) => set("location", e.target.value as IntakeInput["location"])}>
            <option value="">{tx.chooseRoom}</option>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {roomHasFoyerOption(f.location) && (
            <div className="mt-2 space-y-2">
              <Toggle label={tx.foyerUsed} checked={f.foyerUsed} onChange={(v) => set("foyerUsed", v)} />
              {f.foyerUsed && (
                <Indent>
                  <Stepper label={tx.foyerPodiums} value={f.foyerPodiums} onChange={(v) => set("foyerPodiums", v)} />
                  <Stepper label={tx.foyerMics} value={f.foyerMics} onChange={(v) => set("foyerMics", v)} />
                  <Stepper label={tx.foyerTables} value={f.foyerTables} onChange={(v) => set("foyerTables", v)} />
                  <Toggle label={tx.foyerSound} checked={f.foyerSound} onChange={(v) => set("foyerSound", v)} />
                </Indent>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="at">{tx.attendees}</Label>
            <NumberInput id="at" max={149} value={f.expectedAttendees} onChange={(v) => set("expectedAttendees", v)} />
            {(f.expectedAttendees ?? 0) > 149 && <p className="mt-1.5 text-xs text-danger">{tx.capacity}</p>}
          </div>
          <div>
            <Label htmlFor="he">{tx.helpers}</Label>
            <NumberInput id="he" value={f.helpersWanted} onChange={(v) => set("helpersWanted", v)} />
          </div>
        </div>
      </Block>

      <Block title={tx.needs}>
        <Toggle label={tx.stage} checked={f.stage} onChange={(v) => set("stage", v)} />
        {f.stage && <Indent><TextArea aria-label={tx.stageDetails} placeholder={tx.stageDetails} value={f.stageDetails} onChange={(v) => set("stageDetails", v)} /></Indent>}

        <Toggle label={tx.projector} checked={f.projector} onChange={(v) => set("projector", v)} />
        <Toggle label={tx.pcAudio} checked={f.pcAudio} onChange={(v) => set("pcAudio", v)} />

        <Toggle label={tx.light} checked={f.light} onChange={(v) => set("light", v)} />
        {f.light && (
          <Indent>
            <Label htmlFor="lp">{tx.lightingPreset}</Label>
            <select id="lp" className={inputClass} value={f.lightingPreset} onChange={(e) => set("lightingPreset", e.target.value as IntakeInput["lightingPreset"])}>
              {(Object.keys(tx.lights) as (keyof typeof tx.lights)[]).map((k) => (
                <option key={k} value={k}>
                  {tx.lights[k]}
                </option>
              ))}
            </select>
            <TextArea aria-label={tx.lightingNotes} placeholder={tx.lightingNotes} value={f.lightingNotes} onChange={(v) => set("lightingNotes", v)} />
          </Indent>
        )}

        <Toggle label={tx.sound} checked={f.sound} onChange={(v) => set("sound", v)} />
        {f.sound && (
          <Indent>
            <Stepper label={tx.micCount} value={f.micCount} onChange={(v) => set("micCount", v)} />
            <TextInput aria-label={tx.micPurpose} placeholder={tx.micPurpose} value={f.micPurpose} onChange={(v) => set("micPurpose", v)} />
            <Toggle label={tx.bands} checked={f.bands} onChange={(v) => set("bands", v)} />
            {f.bands && <TextArea aria-label={tx.bandDetails} rows={3} placeholder={tx.bandDetails} value={f.bandDetails} onChange={(v) => set("bandDetails", v)} />}
          </Indent>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <Label htmlFor="ch">{tx.chairs}</Label>
            <NumberInput id="ch" max={149} value={f.chairs} onChange={(v) => set("chairs", v)} />
            {(f.chairs ?? 0) > 149 && <p className="mt-1.5 text-xs text-danger">{tx.capacity}</p>}
          </div>
          <div>
            <Label htmlFor="tb">{tx.tables}</Label>
            <NumberInput id="tb" value={f.tables} onChange={(v) => set("tables", v)} />
          </div>
        </div>
        <TextInput aria-label={tx.furnitureNotes} placeholder={tx.furnitureNotes} value={f.furnitureNotes} onChange={(v) => set("furnitureNotes", v)} />

      </Block>

      <Block title={tx.schedule} hint={tx.scheduleHint}>
        <TextArea aria-label={tx.schedule} rows={5} value={f.schedule} onChange={(v) => set("schedule", v)} />
      </Block>

      <Block title={tx.other}>
        <TextArea aria-label={tx.other} rows={4} value={f.otherNotes} onChange={(v) => set("otherNotes", v)} />
      </Block>

      <label className={`flex items-start gap-2.5 text-xs text-muted ${bad.includes("privacyAck") ? "text-danger" : ""}`}>
        <input type="checkbox" className="mt-0.5 size-4 accent-current" checked={f.privacyAck === true} onChange={(e) => set("privacyAck", e.target.checked as true)} required />
        <span>
          {tx.privacy}{" "}
          <Link href="/privatliv#arrangoerer" className="text-fg underline underline-offset-2" target="_blank">
            {tx.privacyLink}
          </Link>
        </span>
      </label>

      <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full sm:w-auto`}>
        {pending ? tx.sending : tx.submit}
      </button>
    </form>
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

function Indent({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 border-l border-line pl-3">{children}</div>;
}
