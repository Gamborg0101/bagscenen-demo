import { describe, expect, it } from "vitest";
import { isEventOver } from "./response";

const at = (iso: string) => new Date(iso);

describe("isEventOver", () => {
  // 30 Oct 2026, 08:22 Copenhagen (CET, UTC+1)
  const now = at("2026-10-30T07:22:00Z").getTime();

  it("is over the day after it ends", () => {
    expect(isEventOver({ startsAt: at("2026-10-29T18:00:00Z"), endsAt: at("2026-10-29T22:00:00Z") }, now)).toBe(true);
  });

  it("is not over on the day it ends", () => {
    expect(isEventOver({ startsAt: at("2026-10-30T06:00:00Z"), endsAt: at("2026-10-30T07:00:00Z") }, now)).toBe(false);
  });

  it("counts an event ending after midnight as today's", () => {
    expect(isEventOver({ startsAt: at("2026-10-29T18:00:00Z"), endsAt: at("2026-10-29T23:30:00Z") }, now)).toBe(false);
  });

  it("uses the start when there is no end", () => {
    expect(isEventOver({ startsAt: at("2026-10-29T18:00:00Z"), endsAt: null }, now)).toBe(true);
    expect(isEventOver({ startsAt: at("2026-10-30T18:00:00Z"), endsAt: null }, now)).toBe(false);
  });
});
