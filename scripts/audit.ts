// CI audit: fails on high/critical advisories (including build/test tools), except ones
// listed in audit-allowlist.json with a reason. An entry stops counting after its reviewBy date.
// Usage: npm run audit
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Advisory = { title: string; url: string; severity: string; name: string };
type Allowed = { id: string; package: string; reason: string; reviewBy: string };

const allowlist: Allowed[] = JSON.parse(readFileSync(new URL("audit-allowlist.json", import.meta.url), "utf8"));
const today = new Date().toISOString().slice(0, 10);

// npm audit exits non-zero when it finds anything; we only want its JSON.
let raw: string;
try {
  raw = execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
} catch (e) {
  raw = (e as { stdout?: string }).stdout ?? "";
}
const report = JSON.parse(raw) as { vulnerabilities?: Record<string, { via: (string | Advisory)[] }> };

// Each advisory sits in some package's `via`; the string entries are just the dependency chain.
const advisories = new Map<string, Advisory>();
for (const v of Object.values(report.vulnerabilities ?? {}))
  for (const a of v.via) if (typeof a === "object" && (a.severity === "high" || a.severity === "critical")) advisories.set(a.url, a);

const ghsa = (url: string) => url.split("/").pop() ?? url;
let failed = false;
for (const a of advisories.values()) {
  const id = ghsa(a.url);
  const allowed = allowlist.find((x) => x.id === id);
  if (allowed && allowed.reviewBy >= today) {
    console.log(`ignored  ${id} ${a.name} (${a.severity}) until ${allowed.reviewBy}: ${allowed.reason}`);
  } else {
    failed = true;
    console.error(`FAIL     ${id} ${a.name} (${a.severity}) ${a.title}${allowed ? ` — allowlist entry expired ${allowed.reviewBy}` : ""}`);
  }
}
for (const x of allowlist)
  if (![...advisories.values()].some((a) => ghsa(a.url) === x.id)) console.log(`stale    ${x.id} no longer reported — remove it from audit-allowlist.json`);

if (failed) process.exit(1);
console.log("audit ok");
