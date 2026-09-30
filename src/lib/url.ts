import "server-only";
import { headers } from "next/headers";

/**
 * Base URL for links we hand out (reset, invite, booking). In production this comes from
 * APP_URL so a forged Host header can never make us generate links to another domain.
 */
export async function appUrl(): Promise<string> {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL must be set in production");
  const h = await headers();
  return `http://${h.get("host") ?? "localhost:3000"}`;
}
