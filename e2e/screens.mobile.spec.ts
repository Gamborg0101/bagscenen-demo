import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { zonedToUtc } from "../src/lib/datetime";
import { eventRefYear } from "../src/lib/events/ref";
import { ADMIN, E2E_DATABASE_URL, MAIL_DOMAIN } from "./env";

// Visual review on a phone: only runs with SCREENSHOTS=<dir>.
//   SCREENSHOTS=/tmp/shots npx playwright test screens --project=mobile --no-deps
const DIR = process.env.SCREENSHOTS;
test.skip(!DIR, "Set SCREENSHOTS=<dir> to capture screenshots");

const HELPER = { email: `skaerm.helper@${MAIL_DOMAIN}`, password: "skærm-test-kode-42" };
const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
let eventId = "";
let planId = "";

test.beforeAll(async () => {
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  const passwordHash = await hash(HELPER.password);
  const helper = await db.user.create({
    data: { firstName: "Skærm", lastName: "Hjælper", email: HELPER.email, phone: "11223344", passwordHash, status: "ACTIVE" },
  });
  const other = await db.user.create({
    data: { firstName: "Anden", lastName: "Hjælper", email: `anden.helper@${MAIL_DOMAIN}`, phone: "55667788", passwordHash, status: "ACTIVE" },
  });

  const start = zonedToUtc(day, "15:00");
  const end = zonedToUtc(day, "18:00");
  const h = (n: number) => new Date(start.getTime() + n * 3600_000);
  const event = await db.event.create({
    data: {
      // High number so it never clashes with events the smoke test creates through the app.
      refYear: eventRefYear(start),
      refNumber: 900,
      title: "Skærmtest: Koncert i salen",
      startsAt: start,
      endsAt: end,
      location: "Store sal",
      eventType: "KONCERT",
      status: "PUBLISHED",
      expectedAttendees: 120,
      helpersWanted: 2,
      needsStage: true,
      stageSize: "4x3",
      podiumHeightCm: 60,
      lectern: true,
      projector: true,
      pcAudio: true,
      handheldMics: 2,
      headsetMics: 1,
      micPurpose: "Oplæg og spørgsmål fra salen",
      bands: true,
      bandCount: 1,
      lightingPreset: "KONCERT",
      chairs: 120,
      tables: 4,
      foyerUsed: true,
      foyerMics: 2,
      foyerSound: true,
      generalNotes: "Dørene åbner kl. 14.45.",
      contacts: { create: [{ name: "Demo Arrangør", role: "Arrangør", email: "arrangoer@example.org", phone: "10000009", sortKey: 0 }] },
      shifts: {
        create: [
          { kind: "OPSAETNING", startsAt: h(-2), endsAt: h(0), durationMinutes: 120, helpersNeeded: 2 },
          { kind: "AFVIKLING", startsAt: h(0), endsAt: h(3), helpersNeeded: 2 },
          { kind: "NEDTAGNING", startsAt: h(3), endsAt: h(4), durationMinutes: 60, helpersNeeded: 2 },
        ],
      },
    },
    include: { shifts: true },
  });
  eventId = event.id;
  const [setup] = event.shifts.sort((a, b) => +a.startsAt - +b.startsAt);

  await db.invitation.create({ data: { eventId, userId: helper.id } });
  await db.invitation.create({
    data: {
      eventId,
      userId: other.id,
      status: "ACCEPTED",
      respondedAt: new Date(),
      note: "Har forelæsning til 16",
      availabilities: {
        create: [
          { shiftId: setup.id, startsAt: h(-2.5), endsAt: h(-0.5) },
          { shiftId: null, startsAt: h(1), endsAt: h(3) },
        ],
      },
    },
  });
  await db.eventNote.create({ data: { eventId, authorId: other.id, body: "Aftalt med arrangøren: scenen skal stå klar kl. 14." } });
  const plan = await db.channelPlan.create({
    data: {
      eventId,
      kind: "BAND",
      name: "Demo Band",
      mixer: "SQ7",
      shareEnabled: true,
      shareExpiresAt: new Date(Date.now() + 8 * 3600_000),
      channels: {
        create: [
          { number: 1, source: "Kick in", gear: "Shure Beta 91A", inputSource: "STAGEBOX", inputNumber: 1 },
          { number: 2, source: "Kick out", gear: "Shure Beta 52A", inputSource: "STAGEBOX", inputNumber: 2 },
          { number: 3, source: "Snare top", gear: "Shure SM57", inputSource: "STAGEBOX", inputNumber: 3 },
          { number: 4, source: "Hi-hat", gear: "Neumann KM184", phantom: true, inputSource: "STAGEBOX", inputNumber: 4 },
          { number: 5, source: "OH L", gear: "AKG C414", phantom: true, inputSource: "STAGEBOX", inputNumber: 5 },
          { number: 6, source: "OH R", gear: "AKG C414", phantom: true, inputSource: "STAGEBOX", inputNumber: 6 },
          { number: 7, source: "Bas DI", di: "MONO", inputSource: "STAGEBOX", inputNumber: 7 },
          { number: 8, source: "Keys L", di: "STEREO", inputSource: "STAGEBOX", inputNumber: 25 },
          { number: 9, source: "Keys R", di: "STEREO", inputSource: "STAGEBOX", inputNumber: 26 },
          { number: 10, source: "Lead vokal", gear: "Shure SM58", inputSource: "MIXER", inputNumber: 1, note: "Ekstra i monitor" },
        ],
      },
    },
  });
  planId = plan.id;
  await db.user.create({
    data: { firstName: "Ny", lastName: "Tilmelding", email: `ny.tilmelding@${MAIL_DOMAIN}`, phone: "99887766", passwordHash, status: "PENDING" },
  });
  await db.$disconnect();
});

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("public pages", async ({ page }) => {
  await page.goto("/login");
  await shot(page, "01-login");
  await page.goto("/opret");
  await shot(page, "02-opret");
  await page.goto("/privatliv");
  await shot(page, "03-privatliv");
});

test("helper pages", async ({ page }) => {
  await login(page, HELPER.email, HELPER.password);
  await shot(page, "10-helper-dashboard");
  await page.goto(`/arrangementer/${eventId}`);
  await expect(page.getByText("HUSK SIDERÆLING")).toBeVisible();
  await shot(page, "11-helper-event");
  await page.click("button:text-is('Tag vagter')");
  await page.locator("label", { hasText: "Opsætning" }).locator("input[type=checkbox]").check();
  await page.click("text=Kan du ikke tage en hel vagt?");
  await page.click("text=+ Eget tidsrum");
  await page.locator(".rounded-lg").first().screenshot({ path: `${DIR}/12-helper-answer-form.png` });
  await page.goto("/profil");
  await shot(page, "13-helper-profil");
  await page.goto(`/arrangementer/${eventId}/kanalplan/${planId}`);
  await shot(page, "14-helper-kanalplan");
  const link = (await page.locator("p.select-all").innerText()).trim();
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 794, height: 1123 });
  await shot(page, "15-kanalplan-print");
  await page.emulateMedia({ media: "screen" });
  await page.context().clearCookies();
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(link);
  await shot(page, "16-kanalplan-public");
});

test("admin pages", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await shot(page, "20-admin-dashboard");
  await page.goto("/admin/arrangementer");
  await shot(page, "21-admin-list");
  await page.goto(`/admin/arrangementer/${eventId}`);
  await shot(page, "22-admin-event");

  await page.goto("/admin/arrangementer/ny");
  await page.fill("#title", "Skærmtest ny");
  await page.fill("#date", day.split("-").reverse().join("/"));
  await page.fill("#start", "15:00");
  await page.fill("#end", "18:00");
  await page.fill("#attendees", "160");
  for (const s of ["Scene / podier", "Projektor / lyd fra computer", "Lyd", "Lys", "Stole / borde", "Andet"]) {
    await page.click(`button[aria-pressed]:text-is('${s}')`);
  }
  await page.click("button[role=radio]:text-is('Store sal')");
  await page.check("text=Bruger også foyeren");
  await page.click("button:text-is('60')");
  await page.click("button:text-is('Standardvagter')");
  await expect(page.locator("select[aria-label=Vagttype]")).toHaveCount(3);
  await shot(page, "23-admin-new-event");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/arrangementer/${eventId}/kanalplan/${planId}/rediger`);
  await shot(page, "27-admin-kanalplan-editor", false);
  await page.setViewportSize({ width: 412, height: 915 });

  await page.goto("/admin/bestillinger");
  await page.fill("input[name=label]", "Skærmtest-institut");
  await page.click("button:text-is('Opret bestillingslink')");
  const url = await page.locator("input[aria-label=Bestillingslink]").inputValue();
  await shot(page, "24-admin-bestillinger");
  await page.goto("/admin/brugere");
  await shot(page, "25-admin-brugere");
  await page.goto("/admin/log");
  await shot(page, "26-admin-log", false);

  await page.context().clearCookies();
  await page.goto(url);
  await page.check("text=Podier / scene / talerstol");
  await page.check("text=Lyd og mikrofoner");
  await page.fill("#at", "200");
  await shot(page, "30-organiser-form");

  await page.emulateMedia({ colorScheme: "dark" });
  await login(page, HELPER.email, HELPER.password);
  await page.goto(`/arrangementer/${eventId}`);
  await shot(page, "40-helper-event-dark");
});
