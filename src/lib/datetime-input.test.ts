import { describe, expect, it } from "vitest";
import { isoToDisplayDate, maskDate, maskTime, parseDate, parseTime } from "./datetime-input";

describe("time field", () => {
  it("masks while typing", () => {
    expect(["1", "15", "153", "1530", "15305", "15:30", "ab12", "9:30", "9.3"].map(maskTime)).toEqual([
      "1", "15", "15:3", "15:30", "15:30", "15:30", "12", "09:30", "09:3",
    ]);
  });

  it("parses to 24-hour HH:MM", () => {
    expect(["9", "09", "930", "0930", "9:30", "9.30", "15:30", "0000", "23:59"].map(parseTime)).toEqual([
      "09:00", "09:00", "09:30", "09:30", "09:30", "09:30", "15:30", "00:00", "23:59",
    ]);
  });

  it("rejects impossible times", () => {
    expect(["24:00", "12:60", "99", "15:3", "abc", ""].map(parseTime)).toEqual([null, null, null, null, null, null]);
  });
});

describe("date field", () => {
  it("masks while typing", () => {
    expect(["1", "10", "101", "1010", "10102", "10102026", "10/10/2026", "10.10.2026", "1/2/2026", "1.2."].map(maskDate)).toEqual([
      "1", "10", "10/1", "10/10", "10/10/2", "10/10/2026", "10/10/2026", "10/10/2026", "01/02/2026", "01/02",
    ]);
  });

  it("parses dd/mm/åååå to ISO", () => {
    expect(["10/10/2026", "1/2/2026", "01.02.2026", "24-12-2026", "10102026"].map(parseDate)).toEqual([
      "2026-10-10", "2026-02-01", "2026-02-01", "2026-12-24", "2026-10-10",
    ]);
  });

  it("rejects dates that don't exist", () => {
    expect(["31/02/2026", "00/10/2026", "10/13/2026", "10/10/26", "2026-10-10"].map(parseDate)).toEqual([null, null, null, null, null]);
  });

  it("shows ISO as dd/mm/åååå", () => {
    expect(isoToDisplayDate("2026-10-10")).toBe("10/10/2026");
    expect(isoToDisplayDate("")).toBe("");
  });
});
