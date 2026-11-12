import { describe, expect, it } from "vitest";
import { formatResetDay, formatResetTime, usageView } from "./usage";

const usage = {
  period: {
    key: "2026-11",
    startsAt: "2026-10-31T18:30:00.000Z",
    resetsAt: "2026-11-30T18:30:00.000Z",
  },
  videos: { used: 20, reserved: 0, max: 20 },
  exportsToday: { used: 0, max: 20, resetsAt: "2026-11-12T18:30:00.000Z" },
  concurrentJobs: { active: 0, max: 2 },
  perVideo: { revisionsMax: 30, generationsMax: 50 },
};

describe("formatResetDay", () => {
  it("shows the reset in the user's time zone", () => {
    expect(formatResetDay("2026-11-30T18:30:00.000Z", "Asia/Kolkata")).toBe("1 Dec");
    // Midnight IST is still 30 November in New York.
    expect(formatResetDay("2026-11-30T18:30:00.000Z", "America/New_York")).toBe("30 Nov");
  });
});

describe("formatResetTime", () => {
  it("is midnight in India and the local time elsewhere", () => {
    expect(formatResetTime("2026-11-12T18:30:00.000Z", "Asia/Kolkata")).toBe("midnight");
    expect(formatResetTime("2026-11-12T18:30:00.000Z", "America/New_York")).toBe("1:30 pm");
    expect(formatResetTime("2026-11-12T18:30:00.000Z", "Europe/London")).toBe("6:30 pm");
  });
});

describe("usageView", () => {
  it("counts reserved videos as taken, like the limit notice", () => {
    const view = usageView(
      { ...usage, videos: { used: 19, reserved: 1, max: 20 } },
      "Asia/Kolkata",
    );
    expect(view.taken).toBe(20);
    expect(view.allowance.reached).toBe(true);
    expect(view.exportsResetAt).toBe("midnight");
  });

  it("says when the allowance is used up and when it comes back", () => {
    expect(usageView(usage, "Asia/Kolkata")).toMatchObject({
      resetsOn: "1 Dec",
      allowance: { reached: true, remaining: 0 },
    });
  });
});
