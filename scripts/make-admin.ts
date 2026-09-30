// Promote an existing (signed-up) user to ADMIN and activate them.
// Usage: npm run make-admin -- someone@example.org
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}

const db = new PrismaClient();
db.user
  .update({ where: { email }, data: { role: "ADMIN", status: "ACTIVE" } })
  .then((u) => console.log(`${u.firstName} ${u.lastName} is now ADMIN.`))
  .catch(() => {
    console.error(`No user with email ${email}. Sign up in the app first.`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
