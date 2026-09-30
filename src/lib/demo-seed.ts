// Fictional sample data for the public demo. Wipes the whole database and fills it again.
// Used by the nightly reset in demo mode and by `npm run seed:demo` against a local database.
// No "server-only" import: the script runs it under tsx too.
import type { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { addDays, toDateInput, zonedToUtc } from "./datetime";
import { DEMO_USERS } from "./demo-users";
import { emptyIntake, intakeSchema } from "./events/intake";
import { ORG } from "./org";

const TABLES = [
  "Availability",
  "Invitation",
  "Shift",
  "EventContact",
  "EventNote",
  "Channel",
  "TechRider",
  "ChannelPlan",
  "EventRequest",
  "Event",
  "PasswordResetToken",
  "AuditLog",
  "AuthAttempt",
  "User",
];

const mail = (local: string) => `${local}@${ORG.emailDomains[0]}`;

const HELPERS = [
  { key: "ane", firstName: "Ane", lastName: "Holm", phone: "20000011" },
  { key: "jonas", firstName: "Jonas", lastName: "Berg", phone: "20000012" },
  { key: "freja", firstName: "Freja", lastName: "Lund", phone: "20000013" },
  { key: "oliver", firstName: "Oliver", lastName: "Dahl", phone: "20000014" },
  { key: "sara", firstName: "Sara", lastName: "Kjær", phone: "20000015" },
] as const;

export async function resetDemoData(db: PrismaClient, opts: { allowOutsideDemo?: boolean } = {}) {
  if (process.env.DEMO_MODE !== "1" && !opts.allowOutsideDemo) throw new Error("resetDemoData only runs in demo mode");

  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);

  // Nobody can log in to these with a password; the demo buttons sign in by role.
  const passwordHash = await hash(randomBytes(32).toString("base64url"));

  const coordinator = await db.user.create({
    data: { id: DEMO_USERS.coordinator.id, firstName: "Demo", lastName: "Koordinator", email: mail("demo.koordinator"), phone: "20000001", passwordHash, role: "ADMIN", status: "ACTIVE" },
  });
  const you = await db.user.create({
    data: { id: DEMO_USERS.helper.id, firstName: "Demo", lastName: "Medhjælper", email: mail("demo.medhjaelper"), phone: "20000002", passwordHash, role: "HELPER", status: "ACTIVE" },
  });
  const h: Record<(typeof HELPERS)[number]["key"], string> = {} as never;
  for (const x of HELPERS) {
    const u = await db.user.create({
      data: { firstName: x.firstName, lastName: x.lastName, email: mail(`${x.firstName}.${x.lastName}`.toLowerCase().replace("æ", "ae")), phone: x.phone, passwordHash, status: "ACTIVE" },
    });
    h[x.key] = u.id;
  }
  // One new signup waiting for approval, so the users page has something to do.
  await db.user.create({ data: { firstName: "Ny", lastName: "Tilmelding", email: mail("ny.tilmelding"), phone: "20000019", passwordHash, status: "PENDING" } });

  const today = toDateInput(new Date());
  const day = (offset: number) => addDays(today, offset);
  const at = (offset: number, time: string) => zonedToUtc(day(offset), time);

  // 1. Concert with a band: shifts, helpers, channel plan, notes.
  const concert = await db.event.create({
    data: {
      title: "Forårskoncert med husbandet",
      startsAt: at(3, "19:00"),
      endsAt: at(3, "22:00"),
      location: "Store sal",
      eventType: "KONCERT",
      status: "PUBLISHED",
      expectedAttendees: 140,
      helpersWanted: 3,
      needsStage: true,
      stageSize: "6x4",
      podiumHeightCm: 60,
      handheldMics: 2,
      bands: true,
      bandCount: 1,
      techRiderNotes: "Bandet medbringer egne in-ears.",
      soundNotes: "Lydprøve kl. 16.30. Husk ekstra DI til keys.",
      lightingPreset: "KONCERT",
      chairs: 120,
      generalNotes: "Dørene åbner kl. 18.30. Bar i foyeren.",
      createdById: coordinator.id,
      contacts: { create: [{ name: "Maja Arrangør", role: "Arrangør", email: "arrangoer@example.org", phone: "20000031" }] },
      shifts: {
        create: [
          { kind: "OPSAETNING", startsAt: at(3, "15:00"), endsAt: at(3, "19:00"), helpersNeeded: 3 },
          { kind: "AFVIKLING", startsAt: at(3, "19:00"), endsAt: at(3, "22:00"), helpersNeeded: 2 },
          { kind: "NEDTAGNING", startsAt: at(3, "22:00"), endsAt: at(3, "23:30"), helpersNeeded: 3 },
        ],
      },
    },
    include: { shifts: { orderBy: { startsAt: "asc" } } },
  });
  const [setup, show, strike] = concert.shifts;
  await accept(db, concert.id, you.id, [setup, show]);
  await accept(db, concert.id, h.ane, [setup, show, strike]);
  await accept(db, concert.id, h.jonas, [strike], "Har forelæsning til kl. 21");
  await db.invitation.create({ data: { eventId: concert.id, userId: h.freja } });
  await db.eventNote.createMany({
    data: [
      { eventId: concert.id, authorId: h.ane, body: "Aftalt med arrangøren: bandet ankommer kl. 16 ved varegården.", createdAt: new Date(Date.now() - 2 * 86_400_000) },
      { eventId: concert.id, authorId: coordinator.id, body: "Scenen er bygget dagen før, så opsætning er mest lyd og lys.", createdAt: new Date(Date.now() - 86_400_000) },
    ],
  });
  await db.channelPlan.create({
    data: {
      eventId: concert.id,
      kind: "BAND",
      name: "Husbandet",
      mixer: "SQ7",
      channels: {
        create: [
          { number: 1, source: "Kick in", gear: "Shure Beta 91A", phantom: true, inputSource: "STAGEBOX", inputNumber: 1 },
          { number: 2, source: "Kick out", gear: "Shure Beta 52", inputSource: "STAGEBOX", inputNumber: 2 },
          { number: 3, source: "Snare", gear: "Shure SM57", inputSource: "STAGEBOX", inputNumber: 3 },
          { number: 4, source: "Hi-hat", gear: "Rode NT5", phantom: true, inputSource: "STAGEBOX", inputNumber: 4 },
          { number: 5, source: "Overhead L", gear: "Rode NT5", phantom: true, inputSource: "STAGEBOX", inputNumber: 5 },
          { number: 6, source: "Overhead R", gear: "Rode NT5", phantom: true, inputSource: "STAGEBOX", inputNumber: 6 },
          { number: 7, source: "Bas", di: "MONO", phantom: true, inputSource: "STAGEBOX", inputNumber: 7 },
          { number: 8, source: "Guitar", gear: "Shure SM57", inputSource: "STAGEBOX", inputNumber: 8 },
          { number: 9, source: "Keys", di: "STEREO", phantom: true, inputSource: "STAGEBOX", inputNumber: 9, note: "L/R på 9–10" },
          { number: 11, source: "Vokal", gear: "Shure SM58", inputSource: "STAGEBOX", inputNumber: 11 },
          { number: 12, source: "Kor", gear: "Shure SM58", inputSource: "STAGEBOX", inputNumber: 12 },
        ],
      },
    },
  });

  // 2. Lecture with reception in the foyer. The demo helper has not answered yet.
  const lecture = await db.event.create({
    data: {
      title: "Gæsteforelæsning og reception",
      startsAt: at(6, "14:00"),
      endsAt: at(6, "17:00"),
      location: "Lille sal",
      eventType: "OPLAEG_DEBAT",
      status: "PUBLISHED",
      expectedAttendees: 80,
      helpersWanted: 2,
      needsStage: true,
      stageSize: "3x3",
      podiumHeightCm: 40,
      lectern: true,
      projector: true,
      pcAudio: true,
      handheldMics: 2,
      headsetMics: 1,
      micPurpose: "Oplægsholder og spørgsmål fra salen",
      lightingPreset: "KONFERENCE",
      chairs: 80,
      foyerUsed: true,
      foyerPodiums: 2,
      foyerPodiumSize: "2x2",
      foyerPodiumHeightCm: 20,
      foyerMics: 1,
      foyerSound: true,
      foyerTables: 6,
      createdById: coordinator.id,
      contacts: {
        create: [
          { name: "Lars Instituttet", role: "Arrangør", email: "institut@example.org", phone: "20000032", sortKey: 0 },
          { name: "Catering", role: "Reception", phone: "20000033", sortKey: 1 },
        ],
      },
      shifts: {
        create: [
          { kind: "OPSAETNING", startsAt: at(6, "12:00"), endsAt: at(6, "14:00"), helpersNeeded: 2 },
          { kind: "AFVIKLING", startsAt: at(6, "14:00"), endsAt: at(6, "17:00"), helpersNeeded: 1 },
          { kind: "NEDTAGNING", startsAt: at(6, "17:00"), endsAt: null, helpersNeeded: 2 },
        ],
      },
    },
    include: { shifts: { orderBy: { startsAt: "asc" } } },
  });
  await db.invitation.create({ data: { eventId: lecture.id, userId: you.id } });
  await accept(db, lecture.id, h.oliver, [lecture.shifts[0], lecture.shifts[1]]);
  await db.invitation.create({ data: { eventId: lecture.id, userId: h.sara, status: "DECLINED", respondedAt: new Date() } });

  // 3. Friday bar in the foyer, still short of people.
  const bar = await db.event.create({
    data: {
      title: "Fredagsbar: semesterstart",
      startsAt: at(10, "15:00"),
      endsAt: at(10, "20:00"),
      location: "Foyer",
      eventType: "FREDAGSBAR",
      status: "PUBLISHED",
      expectedAttendees: 149,
      helpersWanted: 3,
      pcAudio: true,
      lightingPreset: "STEMNING",
      tables: 10,
      extraNotes: "Musik fra arrangørens egen computer.",
      createdById: coordinator.id,
      contacts: { create: [{ name: "Fredagsbarudvalget", role: "Arrangør", email: "fredagsbar@example.org" }] },
      shifts: {
        create: [
          { kind: "OPSAETNING", startsAt: at(10, "13:00"), endsAt: at(10, "15:00"), helpersNeeded: 2 },
          { kind: "AFVIKLING", startsAt: at(10, "15:00"), endsAt: at(10, "20:00"), helpersNeeded: 3 },
        ],
      },
    },
    include: { shifts: { orderBy: { startsAt: "asc" } } },
  });
  await accept(db, bar.id, h.freja, [bar.shifts[1]]);
  await db.invitation.createMany({ data: [h.ane, h.jonas].map((userId) => ({ eventId: bar.id, userId })) });

  // 4. A draft the coordinator is still working on.
  await db.event.create({
    data: {
      title: "Temadag om bæredygtighed",
      startsAt: at(17, "09:00"),
      endsAt: at(17, "15:30"),
      location: "Store sal",
      eventType: "KONFERENCE",
      status: "DRAFT",
      expectedAttendees: 100,
      projector: true,
      handheldMics: 2,
      chairs: 100,
      generalNotes: "Afventer endeligt program fra arrangøren.",
      createdById: coordinator.id,
    },
  });

  // 5. A past event for the archive.
  const past = await db.event.create({
    data: {
      title: "Julekoncert",
      startsAt: at(-20, "19:00"),
      endsAt: at(-20, "21:30"),
      location: "Store sal",
      eventType: "KONCERT",
      status: "PUBLISHED",
      expectedAttendees: 149,
      helpersWanted: 2,
      bands: true,
      bandCount: 2,
      lightingPreset: "KONCERT",
      chairs: 140,
      createdById: coordinator.id,
      shifts: { create: [{ kind: "AFVIKLING", startsAt: at(-20, "17:00"), endsAt: at(-20, "22:00"), helpersNeeded: 2 }] },
    },
    include: { shifts: true },
  });
  await accept(db, past.id, you.id, past.shifts);
  await accept(db, past.id, h.ane, past.shifts);

  // A booking an organiser has filled in, ready to become an event.
  const intake = intakeSchema.parse({
    ...emptyIntake(),
    contactName: "Emil Studieråd",
    contactEmail: "studieraad@example.org",
    contactPhone: "20000034",
    department: "Studierådet",
    title: "Debataften om studiemiljø",
    eventType: "OPLAEG_DEBAT",
    date: day(24),
    startTime: "18:00",
    endTime: "20:30",
    location: "Lille sal",
    expectedAttendees: 60,
    helpersWanted: 2,
    sound: true,
    micCount: 3,
    micPurpose: "Panel med tre debattører og ordstyrer",
    projector: true,
    chairs: 60,
    schedule: "18.00 Velkomst\n18.15 Debat\n19.45 Spørgsmål fra salen",
    privacyAck: true,
  });
  await db.eventRequest.create({
    data: {
      tokenHash: randomBytes(32).toString("hex"),
      label: "Studierådet",
      status: "SUBMITTED",
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
      submittedAt: new Date(Date.now() - 3600_000),
      data: intake,
      createdById: coordinator.id,
    },
  });
}

async function accept(db: PrismaClient, eventId: string, userId: string, shifts: { id: string; startsAt: Date; endsAt: Date | null }[], note?: string) {
  await db.invitation.create({
    data: {
      eventId,
      userId,
      status: "ACCEPTED",
      note,
      respondedAt: new Date(),
      availabilities: { create: shifts.map((s) => ({ shiftId: s.id, startsAt: s.startsAt, endsAt: s.endsAt })) },
    },
  });
}
