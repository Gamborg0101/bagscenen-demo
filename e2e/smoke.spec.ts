import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, CRON_SECRET, HELPER } from "./env";
import { ORG } from "../src/lib/org";

// One serial story: security basics → signup → approval → event → invitation →
// answer → coverage → booking link → GDPR functions → session invalidation.
test.describe.configure({ mode: "serial" });

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
// Date fields show dd/mm/åååå.
const dk = (iso: string) => iso.split("-").reverse().join("/");
let eventId = "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function asUser(browser: Browser, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email, password);
  return { context, page };
}

test("security headers are set", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("protected pages and endpoints refuse anonymous access", async ({ request }) => {
  for (const path of ["/", "/admin/arrangementer", "/admin/brugere", "/admin/log", "/profil", "/profil/mine-data", "/arrangementer/cabc123def456ghi789jkl0mn"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(307);
    expect(res.headers()["location"], path).toContain("/login");
  }
  expect((await request.get("/api/cron/retention")).status()).toBe(401);
  expect((await request.get("/api/cron/retention", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  expect(await (await request.get("/bestil/this-token-does-not-exist-000")).text()).toContain("ugyldigt");
  expect((await request.get("/robots.txt")).status()).toBe(200);
});

test("signup only accepts the allowed mail domains and waits for approval", async ({ page }) => {
  await page.goto("/opret");
  await page.fill("#f-firstName", HELPER.firstName);
  await page.fill("#f-lastName", HELPER.lastName);
  await page.fill("#f-email", "someone@gmail.com");
  await page.fill("#f-phone", HELPER.phone);
  await page.fill("#f-password", HELPER.password);
  await page.fill("#f-passwordConfirm", HELPER.password);
  await page.check("input[name=privacyAccepted]");
  await page.click("button[type=submit]");
  await expect(page.getByText(`Brug din ${ORG.emailLabel}`)).toBeVisible();
  // React resets the form right after the action returns; wait for it before typing again.
  await expect(page.locator("#f-password")).toHaveValue("");

  await page.fill("#f-email", HELPER.email);
  await page.fill("#f-password", HELPER.password);
  await page.fill("#f-passwordConfirm", HELPER.password);
  await page.check("input[name=privacyAccepted]");
  await page.click("button[type=submit]");
  await page.waitForURL("**/afventer");
  await expect(page.getByText("afventer godkendelse fra en koordinator")).toBeVisible();

  // A pending account cannot reach the app.
  await page.goto("/");
  await expect(page).toHaveURL(/\/afventer$/);
});

test("admin approves, creates an event with standard shifts and invites", async ({ browser }) => {
  const { context, page } = await asUser(browser, ADMIN.email, ADMIN.password);

  await page.goto("/admin/brugere");
  await page.locator("button", { hasText: /^Godkend$/ }).click();
  await expect(page.getByText("Ingen nye tilmeldinger.")).toBeVisible();

  await page.goto("/admin/arrangementer/ny");
  await page.fill("#title", "E2E-arrangement");
  await page.fill("#date", dk(inDays(10)));
  await page.fill("#start", "15:00");
  await page.fill("#end", "18:00");
  await page.click("button:text-is('Standardvagter')");
  await expect(page.locator("select[aria-label=Vagttype]")).toHaveCount(3);
  // Bands on, so the event gets the channel plan section.
  await page.click("button[aria-pressed]:text-is('Lyd')");
  await page.getByText("Der kommer bands").click();
  await page.click("button[type=submit]");
  await page.waitForURL(/\/admin\/arrangementer\/c[a-z0-9]+$/);
  eventId = page.url().split("/").pop()!;

  await page.click("button:text-is('Invitér medhjælpere')");
  await page.locator("label", { hasText: `${HELPER.firstName} ${HELPER.lastName}` }).locator("input").check();
  await page.click("button:has-text('Invitér 1')");
  await expect(page.getByText("1 inviteret")).toBeVisible();
  await context.close();
});

test("helper accepts with split time windows and admin sees the gap", async ({ browser }) => {
  const helper = await asUser(browser, HELPER.email, HELPER.password);
  const page = helper.page;
  await expect(page.getByText("Nye invitationer")).toBeVisible();
  await page.click("text=Svar →");
  await page.click("button:text-is('Ja, jeg kan')");
  // Set-up is a duration shift: the helper picks their own start time.
  await page.locator("label", { hasText: "Opsætning" }).locator("input[type=checkbox]").check();
  await page.fill("input[aria-label='Starttid for Opsætning']", "12:30");
  // Part of the event only, via "own time window".
  await page.click("text=Kan du ikke tage en hel vagt?");
  await page.click("text=+ Eget tidsrum");
  await page.click("text=+ Eget tidsrum");
  await page.locator("input[aria-label=Fra]").nth(0).fill("15:00");
  await page.locator("input[aria-label=Til]").nth(0).fill("16:00");
  await page.locator("input[aria-label=Fra]").nth(1).fill("17:00");
  await page.locator("input[aria-label=Til]").nth(1).fill("18:00");
  await page.click("button:text-is('Send svar')");
  await expect(page.getByText("Du er på")).toBeVisible();
  await expect(page.getByText("Opsætning 12.30–14.30")).toBeVisible();
  await expect(page.getByRole("figure", { name: /Tidslinje/ })).toBeVisible();

  // Helpers cannot reach admin pages or events they are not invited to.
  await page.goto("/admin/brugere");
  await expect(page).toHaveURL(/\/$/);
  const res = await page.goto("/arrangementer/cabc123def456ghi789jkl0mn");
  expect(res?.status()).toBe(404);
  await helper.context.close();

  const admin = await asUser(browser, ADMIN.email, ADMIN.password);
  await admin.page.goto(`/admin/arrangementer/${eventId}`);
  // The gap shows as the red "Mangler" row in the timeline.
  await expect(admin.page.getByRole("figure", { name: /Tidslinje/ }).getByText(/^Mangler \(\d+\)$/)).toBeVisible();
  await admin.context.close();
});

test("helper on the event builds a channel plan and shares it by QR link", async ({ browser }) => {
  const { context, page } = await asUser(browser, HELPER.email, HELPER.password);
  await page.goto(`/arrangementer/${eventId}`);
  await page.click("text=+ Ny kanalplan");
  await page.click("button[role=radio]:text-is('Et band')");
  await page.fill("input[name=name]", "E2E Band");
  await page.click("button:text-is('Opret')");
  await page.waitForURL(/\/kanalplan\/c[a-z0-9]+\/rediger$/);

  await page.click("text=+ Trommesæt");
  await expect(page.locator("input[aria-label='Kilde kanal 1']")).toHaveValue("Kick in");
  await page.selectOption("select[aria-label='Inputtype kanal 1']", "STAGEBOX");
  await page.fill("input[aria-label='Inputnummer kanal 1']", "1");
  await page.fill("input[aria-label='Kilde kanal 11']", "Bas DI");
  await page.selectOption("select[aria-label='DI kanal 11']", "MONO");

  // Leaving with unsaved changes asks first.
  await page.click("text=Vis / print");
  await expect(page.getByRole("dialog", { name: "Vil du gemme dine ændringer?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Gem", exact: true }).click();
  await page.waitForURL(/\/kanalplan\/c[a-z0-9]+$/);
  await expect(page.getByText("11 kanaler")).toBeVisible();
  await expect(page.locator("td", { hasText: "Stagebox 1" })).toBeVisible();

  // Techrider: real PDFs only, downloaded safely, never public.
  const riderUrl = page.url() + "/techrider";
  await page.setInputFiles("input[type=file]", { name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html><script>alert(1)</script>") });
  await expect(page.getByText("Filen er ikke en PDF.")).toBeVisible();
  await page.setInputFiles("input[type=file]", { name: "E2E rider.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% e2e\n%%EOF\n") });
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByText("E2E rider.pdf")).toBeVisible();
  const dl = await page.request.get(riderUrl);
  expect(dl.headers()["content-type"]).toBe("application/pdf");
  expect(dl.headers()["content-disposition"]).toContain("attachment");
  expect(dl.headers()["content-security-policy"]).toContain("sandbox");
  const forged = await page.request.post(riderUrl, {
    headers: { origin: "https://evil.example" },
    multipart: { file: { name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") } },
  });
  expect(forged.status()).toBe(403);
  await page.click("button:text-is('Lav QR-kode og link')");
  const link = (await page.locator("p.select-all").innerText()).trim();
  await expect(page.getByText("Linket udløber")).toBeVisible();
  expect(link).toMatch(/\/kanalplan\/c[a-z0-9]+\.[A-Za-z0-9_-]{43}$/);

  // Anyone with the link can read the plan without logging in — and sees no people.
  const anon = await browser.newContext();
  const pub = await anon.newPage();
  await pub.goto(link);
  await expect(pub.getByRole("heading", { name: "Kanalplan · E2E Band" })).toBeVisible();
  await expect(pub.locator("td", { hasText: "Kick in" })).toBeVisible();
  expect(await pub.content()).not.toContain(HELPER.phone);
  expect(await pub.content()).not.toContain("E2E rider.pdf");
  expect((await anon.request.get(riderUrl)).status()).toBe(404);

  // Switching sharing off makes the old link stop working.
  await page.click("button:text-is('Slå deling fra')");
  await expect(page.getByRole("button", { name: "Lav QR-kode og link" })).toBeVisible();
  await pub.reload();
  await expect(pub.getByText("Linket er ugyldigt")).toBeVisible();
  await anon.close();
  await context.close();
});

test("booking link works once and becomes an event", async ({ browser }) => {
  const admin = await asUser(browser, ADMIN.email, ADMIN.password);
  await admin.page.goto("/admin/bestillinger");
  await admin.page.fill("input[name=label]", "E2E-institut");
  await admin.page.click("button:text-is('Opret bestillingslink')");
  const url = await admin.page.locator("input[aria-label=Bestillingslink]").inputValue();
  expect(url).toMatch(/\/bestil\/[A-Za-z0-9_-]{40,}$/);

  const organiser = await browser.newContext();
  const form = await organiser.newPage();
  await form.goto(url);
  await form.fill("#cn", "E2E Arrangør");
  await form.fill("#ce", "arrangoer@example.org");
  await form.fill("#ti", "E2E-bestilling");
  await form.fill("#da", dk(inDays(20)));
  await form.fill("#st", "10:00");
  await form.locator("input[type=checkbox][required]").check();
  await form.click("button[type=submit]");
  await expect(form.getByText("Tak!")).toBeVisible();
  await form.reload();
  await expect(form.getByText("ugyldigt")).toBeVisible();
  await organiser.close();

  await admin.page.goto("/admin/bestillinger");
  await admin.page.click("text=Se bestilling");
  await admin.page.click("text=Opret arrangement ud fra bestillingen");
  await expect(admin.page.locator("#title")).toHaveValue("E2E-bestilling");
  await admin.page.click("button[aria-pressed]:text-is('Lyd')");
  await admin.page.getByText("Der kommer bands").click();
  await admin.page.click("button[type=submit]");
  await admin.page.waitForURL(/\/admin\/arrangementer\/c[a-z0-9]+$/);
  await expect(admin.page.getByText("E2E Arrangør")).toBeVisible();

  // A band that played before: start its channel plan from the earlier one.
  await admin.page.click("text=+ Ny kanalplan");
  await admin.page.click("button[role=radio]:text-is('Et band')");
  const option = admin.page.locator("select[aria-label='Kopiér fra tidligere plan'] option", { hasText: "E2E Band" });
  await admin.page.selectOption("select[aria-label='Kopiér fra tidligere plan']", await option.getAttribute("value"));
  await admin.page.click("button:text-is('Opret')");
  await admin.page.waitForURL(/\/rediger$/);
  await expect(admin.page.locator("#plan-name")).toHaveValue("E2E Band");
  await expect(admin.page.locator("input[aria-label='Kilde kanal 1']")).toHaveValue("Kick in");
  await admin.context.close();
});

test("helper can export data and add to calendar; only the coordinator can cancel them", async ({ browser }) => {
  const { context, page } = await asUser(browser, HELPER.email, HELPER.password);

  const data = await (await page.request.get("/profil/mine-data")).json();
  expect(data.profile.email).toBe(HELPER.email);
  expect(JSON.stringify(data)).not.toContain("passwordHash");

  const ics = await page.request.get(`/arrangementer/${eventId}/kalender`);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("BEGIN:VEVENT");

  // Once on, a helper can't change or cancel on their own — only the coordinator can.
  await page.goto(`/arrangementer/${eventId}`);
  await expect(page.getByText("Kontakt koordinatoren")).toBeVisible();
  await expect(page.getByRole("button", { name: "Meld afbud" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ret/ })).toHaveCount(0);

  const admin = await asUser(browser, ADMIN.email, ADMIN.password);
  await admin.page.goto(`/admin/arrangementer/${eventId}`);
  await admin.page.getByRole("button", { name: "Meld fra" }).click();
  await expect(admin.page.getByText("Kan ikke")).toBeVisible();
  await admin.context.close();

  await page.reload();
  await expect(page.getByText("Du har meldt fra")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Meldt fra (1)")).toBeVisible();
  await context.close();
});

test("changing password logs out every other session", async ({ browser }) => {
  const a = await asUser(browser, HELPER.email, HELPER.password);
  const b = await asUser(browser, HELPER.email, HELPER.password);

  await a.page.goto("/profil");
  await a.page.fill("#f-current", HELPER.password);
  await a.page.fill("#f-password", "ny-blå-hest-på-taget-8");
  await a.page.fill("#f-passwordConfirm", "ny-blå-hest-på-taget-8");
  await a.page.click("button:text-is('Skift adgangskode')");
  await a.page.waitForURL(/\/login/);

  await b.page.goto("/profil");
  await expect(b.page).toHaveURL(/\/login/);
  await a.context.close();
  await b.context.close();
});

test("retention job runs with the cron secret", async ({ request }) => {
  const res = await request.get("/api/cron/retention", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toHaveProperty("pendingSignups");
});
