import { expect, test } from "@playwright/test";
import { ADMIN } from "./env";

// Phone width: no page may scroll sideways.
test("pages fit a phone screen", async ({ page }) => {
  for (const path of ["/login", "/opret", "/privatliv"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }

  await page.goto("/login");
  await page.fill("#f-email", ADMIN.email);
  await page.fill("#f-password", ADMIN.password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  for (const path of ["/", "/admin/arrangementer", "/admin/arrangementer/ny", "/admin/bestillinger", "/admin/brugere", "/profil"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
