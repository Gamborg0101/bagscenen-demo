import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, CRON_SECRET, E2E_DATABASE_URL, E2E_PORT } from "./e2e/env";
import { ORG } from "./src/lib/org";

// Smoke test against a production build: npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", locale: "da-DK", timezoneId: "Europe/Copenhagen" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/, dependencies: ["desktop"] },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${E2E_PORT}`,
    url: `${BASE_URL}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: E2E_DATABASE_URL,
      DATABASE_URL_UNPOOLED: E2E_DATABASE_URL,
      AUTH_SECRET: "e2e-auth-secret-not-used-anywhere-else-000000",
      APP_URL: BASE_URL,
      CRON_SECRET,
      ALLOWED_EMAIL_DOMAINS: ORG.emailDomains.join(","),
    },
  },
});
