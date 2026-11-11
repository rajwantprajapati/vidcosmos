import { workspaceSchema } from "@vidcosmos/spec/collections";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.ts";
import { systemCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";
import { ensureWorkspace, istPeriod, newWorkspace, workspaceName } from "./workspaces.ts";

const database = useTestDatabase();

beforeAll(async () => {
  await migrate(database.get());
});

describe("istPeriod", () => {
  it("uses the IST date, which is ahead of UTC", () => {
    // 20:00 UTC on 31 Oct is 01:30 on 1 Nov in India.
    expect(istPeriod(new Date("2026-10-31T20:00:00Z"))).toEqual({
      periodKey: "2026-11",
      periodStart: new Date("2026-10-31T18:30:00Z"),
      dayKey: "2026-11-01",
    });
  });

  it("keeps the previous month until midnight IST", () => {
    expect(istPeriod(new Date("2026-10-31T18:29:59Z")).periodKey).toBe("2026-10");
  });

  it("rolls the year over", () => {
    expect(istPeriod(new Date("2026-12-31T19:00:00Z"))).toMatchObject({
      periodKey: "2027-01",
      dayKey: "2027-01-01",
    });
  });
});

describe("workspaceName", () => {
  it.each([
    ["Asha Rao", "Asha's workspace"],
    ["  Rajwant   Prajapati ", "Rajwant's workspace"],
    ["", "My workspace"],
    ["x".repeat(60), "My workspace"],
  ])("%j -> %j", (name, expected) => {
    expect(workspaceName(name)).toBe(expected);
  });
});

describe("newWorkspace", () => {
  it("has the default limits and video defaults, and passes the schema", () => {
    const workspace = newWorkspace(new ObjectId(), "Asha Rao", new Date("2026-11-11T06:30:00Z"));
    expect(workspaceSchema.parse(workspace)).toEqual(workspace);
    expect(workspace).toMatchObject({
      plan: "free",
      defaults: { format: "9:16", language: "en", lengthSec: 60 },
      limits: { videosPerMonth: 20, revisionsPerVideo: 30, exportsPerDay: 20, concurrentJobs: 2 },
      usage: { periodKey: "2026-11", videosUsed: 0, videosReserved: 0, exportsToday: 0 },
      flags: { blocked: false },
    });
  });
});

describe("ensureWorkspace", () => {
  it("creates one workspace for a new user and returns it again later", async () => {
    const owner = { id: new ObjectId(), name: "Asha Rao" };
    const first = await ensureWorkspace(database.get(), owner);
    const again = await ensureWorkspace(database.get(), owner);
    expect(again._id.equals(first._id)).toBe(true);
    expect(
      await systemCollection(database.get(), "workspaces").countDocuments({ ownerId: owner.id }),
    ).toBe(1);
  });

  it("creates only one when two requests race", async () => {
    const owner = { id: new ObjectId(), name: "Ravi" };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => ensureWorkspace(database.get(), owner)),
    );
    const ids = new Set(results.map((w) => w._id.toHexString()));
    expect(ids.size).toBe(1);
    expect(
      await systemCollection(database.get(), "workspaces").countDocuments({ ownerId: owner.id }),
    ).toBe(1);
  });
});
