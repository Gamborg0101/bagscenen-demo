import { describe, expect, it } from "vitest";
import { eventRefYear, formatEventRef, parseEventRef } from "./ref";

describe("event ids", () => {
  it("formats as year and three-digit number", () => {
    expect(formatEventRef({ refYear: 2026, refNumber: 12 })).toBe("2026-012");
    expect(formatEventRef({ refYear: 2026, refNumber: 1234 })).toBe("2026-1234");
  });

  it("reads ids typed in the search field", () => {
    expect(parseEventRef("2026-012")).toEqual({ refYear: 2026, refNumber: 12 });
    expect(parseEventRef(" #12 ")).toEqual({ refNumber: 12 });
    expect(parseEventRef("12")).toEqual({ refNumber: 12 });
    expect(parseEventRef("0")).toBeNull();
    expect(parseEventRef("koncert")).toBeNull();
    expect(parseEventRef("2026-")).toBeNull();
  });

  it("uses the year in Copenhagen, not UTC", () => {
    expect(eventRefYear(new Date("2025-12-31T23:30:00Z"))).toBe(2026);
    expect(eventRefYear(new Date("2025-12-31T22:30:00Z"))).toBe(2025);
  });
});
