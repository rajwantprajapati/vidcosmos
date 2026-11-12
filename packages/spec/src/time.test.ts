import { describe, expect, it } from "vitest";
import { istPeriod, nextIstMidnight, nextIstMonthStart } from "./time.ts";

describe("IST periods", () => {
  it("uses the IST date, which is ahead of UTC", () => {
    expect(istPeriod(new Date("2026-10-31T20:00:00Z"))).toEqual({
      periodKey: "2026-11",
      periodStart: new Date("2026-10-31T18:30:00Z"),
      dayKey: "2026-11-01",
    });
  });

  it("the month resets at midnight IST on the 1st", () => {
    expect(nextIstMonthStart(new Date("2026-11-11T06:30:00Z"))).toEqual(
      new Date("2026-11-30T18:30:00Z"),
    );
    expect(nextIstMonthStart(new Date("2026-12-31T19:00:00Z"))).toEqual(
      new Date("2027-01-31T18:30:00Z"),
    );
  });

  it("the day resets at midnight IST", () => {
    expect(nextIstMidnight(new Date("2026-11-11T06:30:00Z"))).toEqual(
      new Date("2026-11-11T18:30:00Z"),
    );
    expect(nextIstMidnight(new Date("2026-11-11T19:00:00Z"))).toEqual(
      new Date("2026-11-12T18:30:00Z"),
    );
  });
});
