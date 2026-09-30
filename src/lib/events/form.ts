// Shape of the event form, its validation, and conversion to/from the database.
// Pure module (no server imports) so the client form and tests can use it.
import { z } from "zod";
import type { Event, EventContact, Shift, ShiftKind } from "@prisma/client";
import { toDateInput, toTimeInput, zonedTimeAfter, zonedToUtc } from "@/lib/datetime";

/** Max people in the building — applies to attendees and chairs. */
export const VENUE_CAPACITY = 149;
export const capacityMessage = `Bygningen har plads til max ${VENUE_CAPACITY} personer`;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ugyldigt tidspunkt");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vælg en dato");
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();
const count = z.number().int().min(0).max(100000).nullable();
const capped = z.number().int().min(0).max(VENUE_CAPACITY, capacityMessage).nullable();
const mics = z.number().int().min(0).max(50);

/** The rooms events are held in. The foyer can be used alongside the two halls. */
export const ROOMS = ["Store sal", "Lille sal", "Foyer"] as const;
export type Room = (typeof ROOMS)[number];
export const roomHasFoyerOption = (room: string | null | undefined) => room === "Store sal" || room === "Lille sal";
/** Maps stored/free-text room names ("Store Sal") onto the fixed list, or "". */
export function normalizeRoom(value: string | null | undefined): Room | "" {
  return ROOMS.find((r) => r.toLowerCase() === value?.trim().toLowerCase()) ?? "";
}

/** Podiums above this height need side railings. */
export const RAILING_ABOVE_CM = 40;

export const SECTION_KEYS = ["stage", "av", "sound", "light", "furniture", "other"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * A shift is either a fixed time window, or a duration anchored to a time:
 * set-up must be ready by the anchor; other kinds start at the anchor.
 */
export type ShiftMode = "FIXED" | "DURATION";
export const anchorIsDeadline = (kind: ShiftKind) => kind === "OPSAETNING";

const shiftSchema = z
  .object({
    id: z.string().max(40).nullable(),
    kind: z.enum(["OPSAETNING", "AFVIKLING", "NEDTAGNING", "ANDET"]),
    label: text(120),
    date,
    mode: z.enum(["FIXED", "DURATION"]),
    start: time, // FIXED: start · DURATION: the anchor (deadline for set-up, start otherwise)
    end: time.nullable(), // FIXED only; null = "indtil færdig"
    durationMinutes: z.number().int().min(15).max(24 * 60).nullable(),
    notes: text(1000),
  })
  .refine((s) => s.mode === "FIXED" || s.durationMinutes != null, {
    path: ["durationMinutes"],
    message: "Vælg hvor lang tid vagten tager",
  });

export const eventFormSchema = z.object({
  title: z.string().trim().min(1, "Giv arrangementet en titel").max(200),
  date,
  startTime: time,
  endTime: time.nullable(),
  location: z
    .string()
    .refine((v) => v === "" || (ROOMS as readonly string[]).includes(v), "Vælg et lokale")
    .transform((v) => v || null),
  eventType: z.enum(["KONFERENCE", "OPLAEG_DEBAT", "KONCERT", "FREDAGSBAR", "FEST", "RECEPTION", "UNDERVISNING", "ANDET"]),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]),
  expectedAttendees: capped,
  helpersWanted: count,
  generalNotes: text(5000),

  sections: z.object(Object.fromEntries(SECTION_KEYS.map((k) => [k, z.boolean()])) as Record<SectionKey, z.ZodBoolean>),

  // Scene / podier
  stageSize: text(100),
  podiumHeightCm: count,
  lectern: z.boolean(),
  stageNotes: text(2000),
  // Projektor / lyd fra computer
  projector: z.boolean(),
  pcAudio: z.boolean(),
  // Lyd
  handheldMics: mics,
  headsetMics: mics,
  micPurpose: text(500),
  bands: z.boolean(),
  bandCount: count,
  techRiderNotes: text(5000),
  soundNotes: text(2000),
  // Lys
  lightingPreset: z.enum(["INGEN", "KONFERENCE", "UNDERVISNING", "KONCERT", "FEST", "STEMNING"]),
  lightingNotes: text(2000),
  // Møblering
  chairs: capped,
  tables: count,
  otherFurniture: text(1000),
  // Foyer alongside a hall
  foyerUsed: z.boolean(),
  foyerPodiums: mics,
  foyerPodiumSize: text(100),
  foyerPodiumHeightCm: count,
  foyerMics: mics,
  foyerSound: z.boolean(),
  foyerTables: mics,
  // Andet
  extraNotes: text(2000),

  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Navn mangler").max(120),
        role: text(120),
        email: z
          .string()
          .trim()
          .max(254)
          .refine((v) => v === "" || z.email().safeParse(v).success, "Ugyldig e-mail")
          .transform((v) => v || null),
        phone: text(40),
      }),
    )
    .max(10),

  shifts: z.array(shiftSchema).max(20),
});

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormData = z.output<typeof eventFormSchema>;
export type ShiftFormRow = EventFormInput["shifts"][number];

export function emptyEventForm(): EventFormInput {
  return {
    title: "",
    date: "",
    startTime: "",
    endTime: null,
    location: "",
    eventType: "KONFERENCE",
    status: "PUBLISHED",
    expectedAttendees: null,
    helpersWanted: null,
    generalNotes: "",
    sections: { stage: false, av: false, sound: false, light: false, furniture: false, other: false },
    stageSize: "",
    podiumHeightCm: null,
    lectern: false,
    stageNotes: "",
    projector: false,
    pcAudio: false,
    handheldMics: 0,
    headsetMics: 0,
    micPurpose: "",
    bands: false,
    bandCount: null,
    techRiderNotes: "",
    soundNotes: "",
    lightingPreset: "INGEN",
    lightingNotes: "",
    chairs: null,
    tables: null,
    otherFurniture: "",
    foyerUsed: false,
    foyerPodiums: 0,
    foyerPodiumSize: "",
    foyerPodiumHeightCm: null,
    foyerMics: 0,
    foyerSound: false,
    foyerTables: 0,
    extraNotes: "",
    contacts: [],
    shifts: [],
  };
}

/** Opsætning (≈2 t, ready by the start) · Arrangement (the event itself) · Nedtagning (≈2 t from the end). */
export function standardShifts(dateStr: string, startTime: string, endTime: string | null): ShiftFormRow[] {
  const base = { id: null, label: "", notes: "", date: dateStr };
  const rows: ShiftFormRow[] = [
    { ...base, kind: "OPSAETNING", mode: "DURATION", start: startTime, end: null, durationMinutes: 120 },
    { ...base, kind: "AFVIKLING", mode: "FIXED", start: startTime, end: endTime, durationMinutes: null },
  ];
  if (endTime) rows.push({ ...base, kind: "NEDTAGNING", mode: "DURATION", start: endTime, end: null, durationMinutes: 120 });
  return rows;
}

/**
 * Keeps shifts tied to the event times when those change: set-up stays ready by the start,
 * the event shift follows start/end, take-down starts at the end. Shifts the coordinator
 * moved away from the event times are left alone.
 */
export function syncShiftsToEvent(
  shifts: ShiftFormRow[],
  prev: { startTime: string; endTime: string | null },
  next: { startTime: string; endTime: string | null },
): ShiftFormRow[] {
  return shifts.map((s) => {
    const r = { ...s };
    if (next.startTime && r.start === prev.startTime && (r.kind === "OPSAETNING" || r.kind === "AFVIKLING")) r.start = next.startTime;
    if (r.kind === "AFVIKLING" && r.mode === "FIXED" && r.end === prev.endTime) r.end = next.endTime;
    if (r.kind === "NEDTAGNING" && next.endTime && prev.endTime && r.start === prev.endTime) r.start = next.endTime;
    // Take-down only appears in the standard set once there is an end time.
    return r;
  });
}

type EventWithRelations = Event & { contacts: EventContact[]; shifts: Shift[] };

/** DB event → form state. */
export function eventToForm(e: EventWithRelations): EventFormInput {
  const s = (v: string | null) => v ?? "";

  return {
    title: e.title,
    date: toDateInput(e.startsAt),
    startTime: toTimeInput(e.startsAt),
    endTime: e.endsAt ? toTimeInput(e.endsAt) : null,
    location: normalizeRoom(e.location),
    eventType: e.eventType,
    status: e.status,
    expectedAttendees: e.expectedAttendees,
    helpersWanted: e.helpersWanted,
    generalNotes: s(e.generalNotes),
    sections: {
      stage: e.needsStage,
      av: e.projector || e.pcAudio,
      sound: e.handheldMics + e.headsetMics > 0 || e.bands || !!e.micPurpose || !!e.soundNotes || !!e.techRiderNotes,
      light: e.lightingPreset !== "INGEN" || !!e.lightingNotes,
      furniture: e.chairs != null || e.tables != null || !!e.otherFurniture,
      other: !!e.extraNotes,
    },
    stageSize: s(e.stageSize),
    podiumHeightCm: e.podiumHeightCm,
    lectern: e.lectern,
    stageNotes: s(e.stageNotes),
    projector: e.projector,
    pcAudio: e.pcAudio,
    handheldMics: e.handheldMics,
    headsetMics: e.headsetMics,
    micPurpose: s(e.micPurpose),
    bands: e.bands,
    bandCount: e.bandCount,
    techRiderNotes: s(e.techRiderNotes),
    soundNotes: s(e.soundNotes),
    lightingPreset: e.lightingPreset,
    lightingNotes: s(e.lightingNotes),
    chairs: e.chairs,
    tables: e.tables,
    otherFurniture: s(e.otherFurniture),
    foyerUsed: e.foyerUsed,
    foyerPodiums: e.foyerPodiums,
    foyerPodiumSize: s(e.foyerPodiumSize),
    foyerPodiumHeightCm: e.foyerPodiumHeightCm,
    foyerMics: e.foyerMics,
    foyerSound: e.foyerSound,
    foyerTables: e.foyerTables,
    extraNotes: s(e.extraNotes),
    contacts: [...e.contacts]
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((c) => ({ name: c.name, role: s(c.role), email: s(c.email), phone: s(c.phone) })),
    shifts: [...e.shifts]
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((sh) => {
        const duration = sh.durationMinutes != null;
        const anchor = duration && anchorIsDeadline(sh.kind) && sh.endsAt ? sh.endsAt : sh.startsAt;
        return {
          id: sh.id,
          kind: sh.kind,
          label: s(sh.label),
          date: toDateInput(anchor),
          mode: duration ? ("DURATION" as const) : ("FIXED" as const),
          start: toTimeInput(anchor),
          end: !duration && sh.endsAt ? toTimeInput(sh.endsAt) : null,
          durationMinutes: sh.durationMinutes,
          notes: s(sh.notes),
        };
      }),
  };
}

/** Nominal start/end of a shift row in UTC. */
export function shiftTimes(s: EventFormData["shifts"][number]): { startsAt: Date; endsAt: Date | null } {
  const anchor = zonedToUtc(s.date, s.start);
  if (s.mode === "DURATION" && s.durationMinutes != null) {
    const ms = s.durationMinutes * 60_000;
    return anchorIsDeadline(s.kind)
      ? { startsAt: new Date(anchor.getTime() - ms), endsAt: anchor }
      : { startsAt: anchor, endsAt: new Date(anchor.getTime() + ms) };
  }
  return { startsAt: anchor, endsAt: s.end ? zonedTimeAfter(s.date, s.end, anchor) : null };
}

/** Validated form → scalar event fields, shift rows and contacts (UTC). */
export function formToDb(f: EventFormData) {
  const startsAt = zonedToUtc(f.date, f.startTime);
  const endsAt = f.endTime ? zonedTimeAfter(f.date, f.endTime, startsAt) : null;
  const on = f.sections;

  const event = {
    title: f.title,
    startsAt,
    endsAt,
    location: f.location,
    eventType: f.eventType,
    status: f.status,
    expectedAttendees: f.expectedAttendees,
    helpersWanted: f.helpersWanted,
    generalNotes: f.generalNotes,
    // A section that is switched off clears its fields.
    needsStage: on.stage,
    stageSize: on.stage ? f.stageSize : null,
    podiumHeightCm: on.stage ? f.podiumHeightCm : null,
    lectern: on.stage && f.lectern,
    stageNotes: on.stage ? f.stageNotes : null,
    projector: on.av && f.projector,
    pcAudio: on.av && f.pcAudio,
    handheldMics: on.sound ? f.handheldMics : 0,
    headsetMics: on.sound ? f.headsetMics : 0,
    micPurpose: on.sound ? f.micPurpose : null,
    bands: on.sound && f.bands,
    bandCount: on.sound && f.bands ? f.bandCount : null,
    techRiderNotes: on.sound && f.bands ? f.techRiderNotes : null,
    soundNotes: on.sound ? f.soundNotes : null,
    lightingPreset: on.light ? f.lightingPreset : ("INGEN" as const),
    lightingNotes: on.light ? f.lightingNotes : null,
    chairs: on.furniture ? f.chairs : null,
    tables: on.furniture ? f.tables : null,
    otherFurniture: on.furniture ? f.otherFurniture : null,
    ...foyerFields(f),
    extraNotes: on.other ? f.extraNotes : null,
  };

  // Every shift needs the number of helpers wanted for the event.
  const helpersNeeded = Math.max(1, f.helpersWanted ?? 1);
  const shifts = f.shifts.map((s) => ({
    id: s.id,
    kind: s.kind,
    label: s.label,
    ...shiftTimes(s),
    durationMinutes: s.mode === "DURATION" ? s.durationMinutes : null,
    helpersNeeded,
    notes: s.notes,
  }));

  const contacts = f.contacts.map((c, i) => ({ ...c, sortKey: i }));

  return { event, shifts, contacts };
}

/** Foyer details only count when the event is in one of the halls and the foyer is used. */
function foyerFields(f: EventFormData) {
  const on = roomHasFoyerOption(f.location) && f.foyerUsed;
  return {
    foyerUsed: on,
    foyerPodiums: on ? f.foyerPodiums : 0,
    foyerPodiumSize: on && f.foyerPodiums > 0 ? f.foyerPodiumSize : null,
    foyerPodiumHeightCm: on && f.foyerPodiums > 0 ? f.foyerPodiumHeightCm : null,
    foyerMics: on ? f.foyerMics : 0,
    foyerSound: on && f.foyerSound,
    foyerTables: on ? f.foyerTables : 0,
  };
}

/** "½ t", "1 t", "1½ t", "2 t 15 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 30) return h === 0 ? "½ t" : `${h}½ t`;
  if (m === 0) return `${h} t`;
  return h === 0 ? `${m} min` : `${h} t ${m} min`;
}
