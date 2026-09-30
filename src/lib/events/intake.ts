// The organiser booking form ("Guide til studentermedhjælper" as a web form):
// validation, and conversion into the coordinator's event form.
import { z } from "zod";
import { ROOMS, VENUE_CAPACITY, emptyEventForm, normalizeRoom, roomHasFoyerOption, type EventFormInput } from "./form";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date");
const text = (max: number) => z.string().trim().max(max);
const count = z.number().int().min(0).max(100000).nullable();
const capped = z.number().int().min(0).max(VENUE_CAPACITY).nullable();

export const intakeSchema = z.object({
  // Kontaktperson
  contactName: text(120).min(1),
  contactEmail: z.string().trim().max(254).pipe(z.email()),
  contactPhone: text(40),
  department: text(200),
  // Arrangement
  title: text(200).min(1),
  eventType: z.enum(["KONFERENCE", "OPLAEG_DEBAT", "KONCERT", "FREDAGSBAR", "FEST", "RECEPTION", "UNDERVISNING", "ANDET"]),
  date,
  startTime: time,
  endTime: time.nullable(),
  location: z.union([z.enum(ROOMS), z.literal("")]),
  foyerUsed: z.boolean(),
  foyerPodiums: z.number().int().min(0).max(50),
  foyerMics: z.number().int().min(0).max(50),
  foyerSound: z.boolean(),
  foyerTables: z.number().int().min(0).max(50),
  expectedAttendees: capped,
  helpersWanted: count,
  // Scene / podier
  stage: z.boolean(),
  stageDetails: text(2000),
  // Projektor
  projector: z.boolean(),
  pcAudio: z.boolean(),
  // Lys
  light: z.boolean(),
  lightingPreset: z.enum(["INGEN", "KONFERENCE", "UNDERVISNING", "KONCERT", "FEST", "STEMNING"]),
  lightingNotes: text(2000),
  // Lyd
  sound: z.boolean(),
  micCount: z.number().int().min(0).max(50),
  micPurpose: text(500),
  bands: z.boolean(),
  bandDetails: text(5000),
  // Møbler
  chairs: capped,
  tables: count,
  furnitureNotes: text(1000),
  // Program og andet
  schedule: text(5000),
  otherNotes: text(5000),
  privacyAck: z.literal(true),
});

export type IntakeInput = z.input<typeof intakeSchema>;
export type IntakeData = z.output<typeof intakeSchema>;

export function emptyIntake(): IntakeInput {
  return {
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    department: "",
    title: "",
    eventType: "OPLAEG_DEBAT",
    date: "",
    startTime: "",
    endTime: null,
    location: "",
    foyerUsed: false,
    foyerPodiums: 0,
    foyerMics: 0,
    foyerSound: false,
    foyerTables: 0,
    expectedAttendees: null,
    helpersWanted: null,
    stage: false,
    stageDetails: "",
    projector: false,
    pcAudio: false,
    light: false,
    lightingPreset: "KONFERENCE",
    lightingNotes: "",
    sound: false,
    micCount: 0,
    micPurpose: "",
    bands: false,
    bandDetails: "",
    chairs: null,
    tables: null,
    furnitureNotes: "",
    schedule: "",
    otherNotes: "",
    privacyAck: false as unknown as true,
  };
}

/** A submitted booking → a pre-filled event form the coordinator can adjust and save. */
export function intakeToForm(d: IntakeData): EventFormInput {
  const f = emptyEventForm();
  const notes = [
    d.department && `Afdeling: ${d.department}`,
    d.schedule && `Program fra arrangøren:\n${d.schedule}`,
    d.otherNotes && `Andet fra arrangøren:\n${d.otherNotes}`,
  ].filter(Boolean);

  return {
    ...f,
    title: d.title,
    date: d.date,
    startTime: d.startTime,
    endTime: d.endTime,
    location: normalizeRoom(d.location),
    foyerUsed: roomHasFoyerOption(d.location) && d.foyerUsed,
    foyerPodiums: d.foyerPodiums,
    foyerMics: d.foyerMics,
    foyerSound: d.foyerSound,
    foyerTables: d.foyerTables,
    eventType: d.eventType,
    status: "DRAFT",
    expectedAttendees: d.expectedAttendees,
    helpersWanted: d.helpersWanted,
    generalNotes: notes.join("\n\n"),
    sections: {
      stage: d.stage,
      av: d.projector || d.pcAudio,
      sound: d.sound,
      light: d.light,
      furniture: d.chairs != null || d.tables != null || !!d.furnitureNotes,
      other: false,
    },
    stageNotes: d.stageDetails,
    projector: d.projector,
    pcAudio: d.pcAudio,
    handheldMics: d.micCount,
    micPurpose: d.micPurpose,
    bands: d.bands,
    techRiderNotes: d.bandDetails,
    lightingPreset: d.light ? d.lightingPreset : "INGEN",
    lightingNotes: d.lightingNotes,
    chairs: d.chairs,
    tables: d.tables,
    otherFurniture: d.furnitureNotes,
    contacts: [{ name: d.contactName, role: "Arrangør", email: d.contactEmail, phone: d.contactPhone }],
  };
}
