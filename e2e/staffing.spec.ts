import { expect, test, type Browser, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { ADMIN, E2E_DATABASE_URL, MAIL_DOMAIN } from "./env";
import { zonedToUtc } from "../src/lib/datetime";

// Staffing limits on a julefrokost-like event: 3 helpers per shift, one of them with a break
// 17–21. Seeded straight into this run's database so we don't sign up five helpers by hand.
test.describe.configure({ mode: "serial" });

const PASSWORD = "e2e-vagt-kode-2026";
const day = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const at = (hhmm: string) => zonedToUtc(day, hhmm);
const helperEmail = (n: string) => `e2e-staff-${n}@${MAIL_DOMAIN}`;
let eventId = "";

test.beforeAll(async () => {
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  const passwordHash = await hash(PASSWORD);
  const users = await Promise.all(
    ["a", "b", "c", "d", "e"].map((n, i) =>
      db.user.create({
        data: { firstName: `Vagt${n.toUpperCase()}`, lastName: "Test", email: helperEmail(n), phone: `2000000${i}`, passwordHash, status: "ACTIVE" },
      }),
    ),
  );
  const event = await db.event.create({
    data: {
      refYear: 2099,
      refNumber: 900,
      title: "E2E-julefrokost",
      startsAt: at("10:00"),
      endsAt: at("22:00"),
      status: "PUBLISHED",
      helpersWanted: 3,
      shifts: {
        create: [
          // "klar senest 10.00 · ca. 2 t"
          { kind: "OPSAETNING", startsAt: at("08:00"), endsAt: at("10:00"), durationMinutes: 120, helpersNeeded: 3 },
          { kind: "AFVIKLING", startsAt: at("10:00"), endsAt: at("22:00"), helpersNeeded: 3 },
        ],
      },
    },
    include: { shifts: { orderBy: { startsAt: "asc" } } },
  });
  eventId = event.id;
  const [setup, main] = event.shifts;
  const accept = (userId: string, availabilities: { shiftId: string | null; startsAt: Date; endsAt: Date | null }[]) =>
    db.invitation.create({ data: { eventId, userId, status: "ACCEPTED", respondedAt: new Date(), availabilities: { create: availabilities } } });

  // Two take both shifts; the third covers set-up with an own window and takes a break 17–21.
  for (const u of users.slice(0, 2)) {
    await accept(u.id, [
      { shiftId: setup.id, startsAt: setup.startsAt, endsAt: setup.endsAt },
      { shiftId: main.id, startsAt: main.startsAt, endsAt: main.endsAt },
    ]);
  }
  await accept(users[2].id, [
    { shiftId: null, startsAt: at("08:00"), endsAt: at("17:00") },
    { shiftId: null, startsAt: at("21:00"), endsAt: at("22:00") },
  ]);
  await db.$disconnect();
});

async function asUser(browser: Browser, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return { context, page };
}

/** Opens the answer form and adds one own time window. */
async function offerWindow(page: Page, from: string, to: string) {
  await page.goto(`/arrangementer/${eventId}`);
  await page.click("button:text-is('Tag vagter')");
  await page.click("text=Kan du ikke tage en hel vagt?");
  await page.click("text=+ Eget tidsrum");
  await page.locator("input[aria-label=Fra]").fill(from);
  await page.locator("input[aria-label=Til]").fill(to);
  await page.fill("#partial-reason", "Arbejde til 18");
}

test("an own time window counts for a duration shift, and only the real gap is missing", async ({ browser }) => {
  const { context, page } = await asUser(browser, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/arrangementer/${eventId}`);
  await expect(page.locator("li", { hasText: /^Mangler/ })).toHaveCount(1);
  await expect(page.getByText("Mangler 1 · Arrangement 17.00–21.00 · 2 af 3 på")).toBeVisible();
  // Set-up is covered: the third helper's 08–17 window counts for it.
  await expect(page.getByRole("img", { name: "3 af 3 på" })).toHaveCount(1);
  await expect(page.getByRole("img", { name: "2 af 3 på" })).toHaveCount(1);
  await context.close();
});

test("the coordinator approves the quiet evening, and the event counts as covered", async ({ browser }) => {
  const { context, page } = await asUser(browser, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/arrangementer/${eventId}`);
  await page.click("button:text-is('Det er fint')");
  await expect(page.getByText("Det er fint · Arrangement 17.00–21.00 · 2 er nok")).toBeVisible();
  await expect(page.getByRole("figure", { name: /Tidslinje/ }).getByText(/^Mangler/)).toHaveCount(0);
  await page.goto("/admin/arrangementer");
  await expect(page.locator("li", { hasText: "E2E-julefrokost" }).getByText("Dækket")).toBeVisible();
  await context.close();
});

test("a full shift can't be overbooked, even by two helpers at the same moment", async ({ browser }) => {
  const d = await asUser(browser, helperEmail("d"), PASSWORD);
  const e = await asUser(browser, helperEmail("e"), PASSWORD);

  // 12–14 already has three people: refused.
  await offerWindow(d.page, "12:00", "14:00");
  await expect(d.page.locator("label", { hasText: "Arrangement" }).locator("input[type=checkbox]")).toBeDisabled();
  await d.page.click("button:text-is('Send svar')");
  await expect(d.page.getByText(/Arrangement har allerede 3 på i det tidsrum/)).toBeVisible();

  // 18–20 has one place left (two are on). Both ask for it at once: exactly one gets it.
  await offerWindow(d.page, "18:00", "20:00");
  await offerWindow(e.page, "18:00", "20:00");
  await Promise.all([d.page.click("button:text-is('Send svar')"), e.page.click("button:text-is('Send svar')")]);
  const outcome = async (p: Page) => {
    await expect(p.getByText(/Afventer godkendelse|har allerede 3 på/).first()).toBeVisible();
    return (await p.getByText("Afventer godkendelse").count()) > 0;
  };
  const results = [await outcome(d.page), await outcome(e.page)];
  expect(results.filter(Boolean)).toHaveLength(1);

  await d.context.close();
  await e.context.close();
});

test("a partial answer holds the rest of the place until the coordinator answers", async ({ browser }) => {
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  const event = await db.event.create({
    data: {
      refYear: 2099,
      refNumber: 901,
      title: "E2E-delvis",
      startsAt: at("10:00"),
      endsAt: at("14:00"),
      status: "PUBLISHED",
      shifts: { create: [{ kind: "AFVIKLING", startsAt: at("10:00"), endsAt: at("14:00"), helpersNeeded: 1 }] },
    },
  });
  await db.$disconnect();
  const offer = async (page: Page, from: string, to: string) => {
    await page.goto(`/arrangementer/${event.id}`);
    await page.click("button:text-is('Tag vagter')");
    await page.click("text=Kan du ikke tage en hel vagt?");
    await page.click("text=+ Eget tidsrum");
    await page.locator("input[aria-label=Fra]").fill(from);
    await page.locator("input[aria-label=Til]").fill(to);
    await page.fill("#partial-reason", "Forelæsning");
    await page.click("button:text-is('Send svar')");
  };

  // D can only do 10–12: applies, and 12–14 stays held for them until the coordinator answers.
  const d = await asUser(browser, helperEmail("d"), PASSWORD);
  await offer(d.page, "10:00", "12:00");
  await expect(d.page.getByText("Afventer godkendelse")).toBeVisible();
  const e = await asUser(browser, helperEmail("e"), PASSWORD);
  await offer(e.page, "12:00", "14:00");
  await expect(e.page.getByText(/Arrangement har allerede 1 på i det tidsrum/)).toBeVisible();

  // The coordinator says no: D is taken off and the place opens again.
  const admin = await asUser(browser, ADMIN.email, ADMIN.password);
  await admin.page.goto(`/admin/arrangementer/${event.id}`);
  await expect(admin.page.getByText("Afventer din godkendelse")).toBeVisible();
  await admin.page.click("button:text-is('Afvis og tag af')");
  await expect(admin.page.getByText("Kan ikke: VagtD Test (ikke godkendt)")).toBeVisible();
  await d.page.reload();
  await expect(d.page.getByText(/Koordinatoren har ikke godkendt/)).toBeVisible();
  await offer(e.page, "12:00", "14:00");
  await expect(e.page.getByText("Afventer godkendelse")).toBeVisible();

  await Promise.all([d.context.close(), e.context.close(), admin.context.close()]);
});
