// Settings for the end-to-end smoke test. Each run gets its own fresh database
// (created in global setup, dropped afterwards), so existing data is never touched.
import { ORG } from "../src/lib/org";

process.env.E2E_RUN_ID ??= String(Date.now());

/** Test accounts use the first allowed signup domain. */
export const MAIL_DOMAIN = ORG.emailDomains[0];

export const E2E_PORT = 3200;
export const BASE_URL = `http://localhost:${E2E_PORT}`;

/** Connection used only to CREATE/DROP the per-run database. */
export const E2E_SERVER_URL = process.env.E2E_SERVER_URL ?? "postgresql://bagscenen:bagscenen@localhost:5433/bagscenen";
export const E2E_DB_NAME = `bagscenen_e2e_${process.env.E2E_RUN_ID}`;
export const E2E_DATABASE_URL = E2E_SERVER_URL.replace(/\/[^/?]+(\?|$)/, `/${E2E_DB_NAME}$1`);

export const CRON_SECRET = "e2e-cron-secret-that-is-long-enough-000000";

export const ADMIN = { email: `e2e-admin@${MAIL_DOMAIN}`, password: "e2e-admin-kode-2026" };
export const HELPER = {
  firstName: "Test",
  lastName: "Hjælper",
  email: `e2e-helper@${MAIL_DOMAIN}`,
  phone: "12345678",
  password: "blå-hest-på-taget-7",
};

export function assertLocalDatabase(url: string) {
  if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    throw new Error("The e2e test creates and drops a database and only runs against a local server.");
  }
}
