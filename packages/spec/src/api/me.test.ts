import { describe, expect, it } from "vitest";
import type { Workspace } from "../collections/workspace.ts";
import {
  onboardingInput,
  toUsageDto,
  toWorkspaceDto,
  usageDto,
  videoAllowance,
  workspaceDto,
} from "./me.ts";

const workspace = {
  _id: { toHexString: () => "6740a1b2c3d4e5f601234567" },
  schemaVersion: 1,
  ownerId: { toHexString: () => "6740a1b2c3d4e5f601234568" },
  name: "Asha's workspace",
  plan: "free",
  defaults: {
    format: "9:16",
    language: "hi",
    voiceGender: "male",
    tone: "friendly",
    audienceLevel: "beginner",
    lengthSec: 60,
    palette: "midnight",
    captionStyle: "highlight",
    musicTrackId: null,
  },
  limits: {
    videosPerMonth: 20,
    revisionsPerVideo: 30,
    generationsPerVideo: 50,
    exportsPerDay: 20,
    concurrentJobs: 2,
  },
  usage: {
    periodKey: "2026-11",
    periodStart: new Date("2026-10-31T18:30:00Z"),
    videosUsed: 12,
    videosReserved: 1,
    exportsDayKey: "2026-11-11",
    exportsToday: 3,
  },
  flags: { blocked: false },
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Workspace;

describe("toWorkspaceDto", () => {
  it("exposes the id as hex and leaves out owner, limits and usage", () => {
    const dto = toWorkspaceDto(workspace);
    expect(workspaceDto.parse(dto)).toEqual(dto);
    expect(dto).toEqual({
      id: "6740a1b2c3d4e5f601234567",
      name: "Asha's workspace",
      defaults: workspace.defaults,
      blocked: false,
    });
  });
});

describe("toUsageDto", () => {
  it("reports this month's counters and when they reset (IST)", () => {
    const usage = toUsageDto(workspace, new Date("2026-11-11T06:30:00Z"));
    expect(usageDto.parse(usage)).toEqual(usage);
    expect(usage.period).toEqual({
      key: "2026-11",
      startsAt: "2026-10-31T18:30:00.000Z",
      resetsAt: "2026-11-30T18:30:00.000Z",
    });
    expect(usage.videos).toEqual({ used: 12, reserved: 1, max: 20 });
    expect(usage.exportsToday).toEqual({ used: 3, max: 20, resetsAt: "2026-11-11T18:30:00.000Z" });
  });

  it("reads counters from an earlier month or day as zero", () => {
    const usage = toUsageDto(workspace, new Date("2026-12-01T00:00:00Z"));
    expect(usage.period.key).toBe("2026-12");
    expect(usage.videos).toEqual({ used: 0, reserved: 0, max: 20 });
    expect(usage.exportsToday.used).toBe(0);
  });
});

describe("onboardingInput", () => {
  it("accepts the four answers and trims the topic", () => {
    expect(
      onboardingInput.parse({
        persona: "educator",
        topicArea: "  Science  ",
        language: "hi",
        voiceGender: "male",
      }),
    ).toEqual({ persona: "educator", topicArea: "Science", language: "hi", voiceGender: "male" });
  });

  it("refuses unknown answers and long topics", () => {
    expect(
      onboardingInput.safeParse({ persona: "pirate", language: "en", voiceGender: "female" })
        .success,
    ).toBe(false);
    expect(
      onboardingInput.safeParse({
        persona: "other",
        topicArea: "x".repeat(81),
        language: "en",
        voiceGender: "female",
      }).success,
    ).toBe(false);
  });
});

describe("the IST month boundary", () => {
  // The workspace's counters are for November 2026 (IST).
  it("the last second of November in IST is still November", () => {
    const usage = toUsageDto(workspace, new Date("2026-11-30T18:29:59Z"));
    expect(usage.period.key).toBe("2026-11");
    expect(usage.videos.used).toBe(12);
  });

  it("midnight IST on 1 December starts a new month at zero", () => {
    const usage = toUsageDto(workspace, new Date("2026-11-30T18:30:00Z"));
    expect(usage.period).toEqual({
      key: "2026-12",
      startsAt: "2026-11-30T18:30:00.000Z",
      resetsAt: "2026-12-31T18:30:00.000Z",
    });
    expect(usage.videos).toEqual({ used: 0, reserved: 0, max: 20 });
  });

  it("rolls over the year: 1 January 2027 in IST", () => {
    const usage = toUsageDto(workspace, new Date("2026-12-31T19:00:00Z"));
    expect(usage.period.key).toBe("2027-01");
    expect(usage.period.resetsAt).toBe("2027-01-31T18:30:00.000Z");
  });
});

describe("videoAllowance", () => {
  const at = (used: number, reserved = 0, max = 20) => ({ videos: { used, reserved, max } });

  it("counts reserved videos as taken", () => {
    expect(videoAllowance(at(18, 1))).toEqual({ remaining: 1, reached: false, near: true });
    expect(videoAllowance(at(19, 1))).toEqual({ remaining: 0, reached: true, near: true });
  });

  it("is near at 80% and reached at the limit, never negative", () => {
    expect(videoAllowance(at(15))).toMatchObject({ near: false, reached: false });
    expect(videoAllowance(at(16))).toMatchObject({ near: true, reached: false });
    expect(videoAllowance(at(25))).toEqual({ remaining: 0, reached: true, near: true });
  });
});
