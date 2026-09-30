// Local demo data with fictional people: npm run seed:demo
// Wipes the database first. Refuses to run against anything but a local database.
import { PrismaClient } from "@prisma/client";
import { resetDemoData } from "../src/lib/demo-seed";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("seed:demo only runs against a local database.");
  process.exit(1);
}

const db = new PrismaClient();
resetDemoData(db, { allowOutsideDemo: true })
  .then(() => console.log("Demo data ready. Start with DEMO_MODE=1 and use the buttons on /login."))
  .finally(() => db.$disconnect());
