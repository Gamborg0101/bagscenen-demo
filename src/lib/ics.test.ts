import { describe, expect, it } from "vitest";
import { buildIcs, escapeText } from "./ics";

describe("ics", () => {
  it("escapes special characters", () => {
    expect(escapeText("Scene, lys; lyd\nnote\\")).toBe("Scene\\, lys\\; lyd\\nnote\\\\");
  });

  it("writes a valid calendar with UTC times and CRLF line endings", () => {
    const ics = buildIcs(
      [{ uid: "a@bagscenen", start: new Date("2026-10-23T11:00:00Z"), end: new Date("2026-10-23T13:00:00Z"), summary: "Opsætning: Test", location: "Aula" }],
      new Date("2026-09-29T10:00:00Z"),
    );
    expect(ics).toContain("DTSTART:20261023T110000Z\r\n");
    expect(ics).toContain("DTEND:20261023T130000Z\r\n");
    expect(ics).toContain("SUMMARY:Opsætning: Test\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long lines at 75 octets", () => {
    const ics = buildIcs([{ uid: "b", start: new Date(0), end: new Date(1000), summary: "æ".repeat(60) }]);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
