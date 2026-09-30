import { describe, expect, it } from "vitest";
import { formatDay, formatRange, toDateInput, toTimeInput, zonedTimeAfter, zonedToUtc } from "./datetime";

describe("zonedToUtc", () => {
  it("handles summer time (UTC+2)", () => {
    expect(zonedToUtc("2026-09-24", "15:00").toISOString()).toBe("2026-09-24T13:00:00.000Z");
  });

  it("handles winter time (UTC+1)", () => {
    expect(zonedToUtc("2026-12-01", "09:15").toISOString()).toBe("2026-12-01T08:15:00.000Z");
  });

  it("handles the day DST ends (25 Oct 2026)", () => {
    expect(zonedToUtc("2026-10-25", "12:00").toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });

  it("round-trips through the input helpers", () => {
    const d = zonedToUtc("2026-03-29", "18:45");
    expect(toDateInput(d)).toBe("2026-03-29");
    expect(toTimeInput(d)).toBe("18:45");
  });
});

describe("zonedTimeAfter", () => {
  it("rolls an end time past midnight to the next day", () => {
    const start = zonedToUtc("2026-09-24", "19:30");
    const end = zonedTimeAfter("2026-09-24", "01:00", start);
    expect(toDateInput(end)).toBe("2026-09-25");
    expect(formatRange(start, end)).toBe("19.30–01.00 (+1)");
  });

  it("keeps same-day end times", () => {
    const start = zonedToUtc("2026-09-24", "15:00");
    expect(formatRange(start, zonedTimeAfter("2026-09-24", "18:00", start))).toBe("15.00–18.00");
  });
});

describe("formatting", () => {
  it("formats a Danish day", () => {
    expect(formatDay(zonedToUtc("2026-09-24", "15:00"))).toBe("torsdag den 24. september 2026");
  });

  it("formats an open-ended range", () => {
    expect(formatRange(zonedToUtc("2026-09-24", "18:00"), null, "slut")).toBe("18.00–slut");
  });
});
