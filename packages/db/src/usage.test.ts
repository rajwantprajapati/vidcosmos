import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.ts";
import { workspaceCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";
import { sampleDocuments } from "./testing/samples.ts";
import { activeJobCount, readUsage } from "./usage.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();

beforeAll(async () => {
  await migrate(database.get());
});

describe("usage (read side)", () => {
  it("counts only this workspace's queued and running jobs", async () => {
    const db = database.get();
    const workspace = await ensureWorkspace(db, { id: new ObjectId(), name: "Asha" });
    const other = await ensureWorkspace(db, { id: new ObjectId(), name: "Ravi" });
    const jobs = workspaceCollection(db, "jobs");
    const job = (workspaceId: ObjectId, status: "queued" | "running" | "succeeded" | "failed") => {
      // Without the sample's Idempotency-Key, which is unique per workspace.
      const { idempotencyKey: _key, ...sample } = sampleDocuments(workspaceId).jobs;
      return { ...sample, _id: new ObjectId(), status };
    };
    for (const status of ["queued", "running", "succeeded", "failed"] as const) {
      await jobs.insertOne(job(workspace._id, status));
    }
    await jobs.insertOne(job(other._id, "running"));

    expect(await activeJobCount(db, workspace)).toBe(2);
    const usage = await readUsage(db, workspace, new Date("2026-11-12T06:00:00Z"));
    expect(usage.concurrentJobs).toEqual({ active: 2, max: 2 });
  });

  it("reads this month's counters and the limits", async () => {
    const db = database.get();
    const workspace = await ensureWorkspace(
      db,
      { id: new ObjectId(), name: "Asha" },
      new Date("2026-11-12T06:00:00Z"),
    );
    await workspaceCollection(db, "workspaces").updateOne(
      { _id: workspace._id },
      { $set: { "usage.videosUsed": 7, "usage.exportsToday": 3 } },
    );
    const fresh = (await workspaceCollection(db, "workspaces").findOne({ _id: workspace._id }))!;
    const usage = await readUsage(db, fresh, new Date("2026-11-12T08:00:00Z"));
    expect(usage.videos).toEqual({ used: 7, reserved: 0, max: 20 });
    expect(usage.exportsToday).toMatchObject({ used: 3, max: 20 });
    expect(usage.perVideo).toEqual({ revisionsMax: 30, generationsMax: 50 });
  });
});
