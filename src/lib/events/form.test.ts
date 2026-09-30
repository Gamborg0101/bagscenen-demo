import { describe, expect, it } from "vitest";
import type { Event } from "@prisma/client";
import { formatRange, toDateInput, toTimeInput } from "@/lib/datetime";
import { VENUE_CAPACITY, emptyEventForm, eventFormSchema, eventToForm, formToDb, formatDuration, normalizeRoom, standardShifts, syncShiftsToEvent } from "./form";
import { requirementSections } from "./requirements";

// Raw form input (before validation) for schema tests.
const input = (overrides: Partial<ReturnType<typeof emptyEventForm>> = {}) => ({ ...emptyEventForm(), title: "Testarrangement", date: "2026-09-24", startTime: "15:00", endTime: "18:00", ...overrides });

function valid(overrides: Partial<ReturnType<typeof emptyEventForm>> = {}) {
  return eventFormSchema.parse({ ...emptyEventForm(), title: "Testarrangement", date: "2026-09-24", startTime: "15:00", endTime: "18:00", ...overrides });
}

describe("standardShifts", () => {
  it("creates set-up (duration, ready by start), event (fixed) and take-down (duration from end)", () => {
    const rows = standardShifts("2026-09-24", "15:00", "18:00");
    expect(rows.map((r) => [r.kind, r.mode, r.start, r.end, r.durationMinutes])).toEqual([
      ["OPSAETNING", "DURATION", "15:00", null, 120],
      ["AFVIKLING", "FIXED", "15:00", "18:00", null],
      ["NEDTAGNING", "DURATION", "18:00", null, 120],
    ]);
  });

  it("leaves out take-down when there is no end time", () => {
    expect(standardShifts("2026-09-24", "15:00", null).map((r) => r.kind)).toEqual(["OPSAETNING", "AFVIKLING"]);
  });
});

describe("syncShiftsToEvent", () => {
  it("moves set-up, event and take-down along with the event times", () => {
    const rows = standardShifts("2026-09-24", "15:00", "18:00");
    const moved = syncShiftsToEvent(rows, { startTime: "15:00", endTime: "18:00" }, { startTime: "09:00", endTime: "16:00" });
    expect(moved.map((r) => [r.kind, r.start, r.end])).toEqual([
      ["OPSAETNING", "09:00", null],
      ["AFVIKLING", "09:00", "16:00"],
      ["NEDTAGNING", "16:00", null],
    ]);
  });

  it("leaves shifts the coordinator moved on their own alone", () => {
    const rows = standardShifts("2026-09-24", "15:00", "18:00").map((r) => (r.kind === "OPSAETNING" ? { ...r, start: "12:00" } : r));
    const moved = syncShiftsToEvent(rows, { startTime: "15:00", endTime: "18:00" }, { startTime: "16:00", endTime: "18:00" });
    expect(moved[0].start).toBe("12:00");
    expect(moved[1].start).toBe("16:00");
  });
});

describe("formToDb", () => {
  it("clears fields of sections that are switched off", () => {
    const { event } = formToDb(valid({ chairs: 140, handheldMics: 2, sections: { ...emptyEventForm().sections, sound: true } }));
    expect(event.chairs).toBeNull();
    expect(event.handheldMics).toBe(2);
  });

  it("turns duration shifts into nominal windows anchored correctly", () => {
    const { shifts } = formToDb(valid({ helpersWanted: 3, shifts: standardShifts("2026-09-24", "15:00", "18:00") }));
    const [setup, run, teardown] = shifts;
    expect([toTimeInput(setup.startsAt), toTimeInput(setup.endsAt!), setup.durationMinutes]).toEqual(["13:00", "15:00", 120]);
    expect([formatRange(run.startsAt, run.endsAt), run.durationMinutes]).toEqual(["15.00–18.00", null]);
    expect([toTimeInput(teardown.startsAt), toTimeInput(teardown.endsAt!), teardown.durationMinutes]).toEqual(["18:00", "20:00", 120]);
    // Every shift needs the number of helpers wanted for the event.
    expect(shifts.map((x) => x.helpersNeeded)).toEqual([3, 3, 3]);
  });

  it("keeps fixed shifts without an end open-ended", () => {
    const { shifts } = formToDb(
      valid({
        shifts: [{ id: null, kind: "NEDTAGNING", label: "", date: "2026-09-24", mode: "FIXED", start: "18:00", end: null, durationMinutes: null, notes: "" }],
      }),
    );
    expect(shifts[0].endsAt).toBeNull();
  });

  it("rolls an event past midnight to the next day", () => {
    const { event } = formToDb(valid({ startTime: "19:30", endTime: "02:00" }));
    expect(toDateInput(event.endsAt!)).toBe("2026-09-25");
  });
});

describe("validation", () => {
  it("caps attendees and chairs at the building capacity", () => {
    expect(eventFormSchema.safeParse(input({ expectedAttendees: VENUE_CAPACITY, chairs: VENUE_CAPACITY })).success).toBe(true);
    const tooMany = eventFormSchema.safeParse({ ...emptyEventForm(), title: "x", date: "2026-09-24", startTime: "15:00", expectedAttendees: 150, chairs: 200 });
    expect(tooMany.success).toBe(false);
    expect(tooMany.error?.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["expectedAttendees", "chairs"]));
  });

  it("requires a duration for duration shifts", () => {
    const r = eventFormSchema.safeParse({
      ...emptyEventForm(),
      title: "x",
      date: "2026-09-24",
      startTime: "15:00",
      shifts: [{ id: null, kind: "OPSAETNING", label: "", date: "2026-09-24", mode: "DURATION", start: "15:00", end: null, durationMinutes: null, notes: "" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing title and bad contact email", () => {
    const r = eventFormSchema.safeParse({
      ...emptyEventForm(),
      date: "2026-09-24",
      startTime: "15:00",
      contacts: [{ name: "Kontaktperson", role: "", email: "not-an-email", phone: "" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["title", "contacts.0.email"]));
  });
});

describe("eventToForm", () => {
  it("round-trips fields, sections and duration shifts", () => {
    const data = formToDb(
      valid({
        chairs: 140,
        tables: 4,
        sections: { ...emptyEventForm().sections, furniture: true },
        shifts: standardShifts("2026-09-24", "15:00", "18:00"),
      }),
    );
    const event = { id: "e1", ...data.event, createdById: null, createdAt: new Date(), updatedAt: new Date() } as Event;
    const shifts = data.shifts.map((s, i) => ({ ...s, id: `s${i}`, eventId: "e1" }));

    const form = eventToForm({ ...event, contacts: [], shifts });
    expect(form.date).toBe("2026-09-24");
    expect(form.sections.furniture).toBe(true);
    expect(form.sections.sound).toBe(false);
    expect(form.shifts.map((s) => [s.kind, s.mode, s.start, s.durationMinutes])).toEqual([
      ["OPSAETNING", "DURATION", "15:00", 120],
      ["AFVIKLING", "FIXED", "15:00", null],
      ["NEDTAGNING", "DURATION", "18:00", 120],
    ]);

    expect(requirementSections(event)).toEqual([{ title: "Stole / borde", items: ["140 stole", "4 borde"], notes: [], warnings: [] }]);
  });
});

describe("rooms and foyer", () => {
  it("maps free-text rooms onto the fixed list", () => {
    expect(["Store Sal", " lille sal ", "Foyer", "Aulaen", null].map(normalizeRoom)).toEqual(["Store sal", "Lille sal", "Foyer", "", ""]);
  });

  it("rejects rooms outside the list", () => {
    expect(eventFormSchema.safeParse(input({ location: "Store sal" })).success).toBe(true);
    expect(eventFormSchema.safeParse(input({ location: "Aulaen" })).success).toBe(false);
  });

  it("only keeps foyer details when the event is in one of the halls", () => {
    const foyer = { foyerUsed: true, foyerPodiums: 1, foyerMics: 2, foyerSound: true, foyerTables: 4 };
    expect(formToDb(valid({ location: "Store sal", ...foyer })).event).toMatchObject(foyer);
    expect(formToDb(valid({ location: "Foyer", ...foyer })).event).toMatchObject({ foyerUsed: false, foyerMics: 0, foyerSound: false });
  });

  it("shows the foyer and warns about side railings above 40 cm", () => {
    const data = formToDb(
      valid({ location: "Lille sal", foyerUsed: true, foyerMics: 2, foyerSound: true, podiumHeightCm: 60, sections: { ...emptyEventForm().sections, stage: true } }),
    );
    const sections = requirementSections({ id: "e", ...data.event, createdById: null, createdAt: new Date(), updatedAt: new Date() } as Event);
    expect(sections.find((x) => x.title === "Scene / podier")?.warnings).toEqual(["HUSK SIDERÆLING"]);
    expect(sections.find((x) => x.title === "Foyer")?.items).toEqual(["2 mikrofoner", "Lyd fra anlægget"]);
  });

  it("keeps foyer podium size and height only when there are podiums", () => {
    const foyer = { location: "Store sal", foyerUsed: true, foyerPodiumSize: "2x2", foyerPodiumHeightCm: 60 };
    const withPodiums = formToDb(valid({ ...foyer, foyerPodiums: 2 })).event;
    expect(withPodiums).toMatchObject({ foyerPodiumSize: "2x2", foyerPodiumHeightCm: 60 });
    const section = requirementSections({ id: "e", ...withPodiums, createdById: null, createdAt: new Date(), updatedAt: new Date() } as Event).find(
      (x) => x.title === "Foyer",
    );
    expect(section?.items).toEqual(["2 podier (2x2 m, ben 60 cm)"]);
    expect(section?.warnings).toEqual(["HUSK SIDERÆLING"]);
    expect(formToDb(valid({ ...foyer, foyerPodiums: 0 })).event).toMatchObject({ foyerPodiumSize: null, foyerPodiumHeightCm: null });
  });
});

describe("formatDuration", () => {
  it("writes Danish durations", () => {
    expect([30, 60, 90, 120, 135].map(formatDuration)).toEqual(["½ t", "1 t", "1½ t", "2 t", "2 t 15 min"]);
  });
});
