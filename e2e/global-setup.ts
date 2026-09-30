import { execSync } from "node:child_process";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { ADMIN, E2E_DATABASE_URL, E2E_DB_NAME, E2E_SERVER_URL, assertLocalDatabase } from "./env";

// Creates a brand-new database for this run, applies migrations, adds one admin.
// Returns the teardown, which drops only that database.
export default async function globalSetup() {
  assertLocalDatabase(E2E_SERVER_URL);
  if (!/^bagscenen_e2e_\d+$/.test(E2E_DB_NAME)) throw new Error("Unexpected e2e database name");

  const server = new PrismaClient({ datasourceUrl: E2E_SERVER_URL });
  await server.$executeRawUnsafe(`CREATE DATABASE "${E2E_DB_NAME}"`);

  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DATABASE_URL_UNPOOLED: E2E_DATABASE_URL },
  });

  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  await db.user.create({
    data: {
      firstName: "E2E",
      lastName: "Admin",
      email: ADMIN.email,
      phone: "87654321",
      passwordHash: await hash(ADMIN.password),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  await db.$disconnect();

  return async () => {
    await server.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}" WITH (FORCE)`);
    await server.$disconnect();
  };
}
