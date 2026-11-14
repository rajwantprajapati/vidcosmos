// F13: usage and moderation events against MongoDB: one usage event per call with its cost,
// every block recorded with a short excerpt, allowed inputs only when sampled, and three
// blocks in 24 hours flagging the workspace for review, once.
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { recordModeration, recordUsage } from "./llm-events.ts";
import { migrate } from "./migrate.ts";
import { workspaceCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

const owner = async () => {
  const userId = new ObjectId();
  const workspace = await ensureWorkspace(db(), { id: userId, name: "Asha Rao" });
  return { userId, workspaceId: workspace._id };
};

describe("usage events", () => {
  it("records a call with its tokens, cost and attempt", async () => {
    const { userId, workspaceId } = await owner();
    const at = new Date("2026-11-14T06:00:00Z");
    await recordUsage(
      db(),
      {
        workspaceId,
        userId,
        provider: "anthropic",
        operation: "moderation",
        model: "claude-haiku-5-5",
        units: { inputTokens: 300, outputTokens: 40 },
        cached: false,
        costMicroUsd: 50,
        priceVersion: "2026-11",
        attempt: 2,
      },
      at,
    );
    const rows = await workspaceCollection(db(), "usage_events").find({ workspaceId }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      costMicroUsd: 50,
      attempt: 2,
      createdAt: at,
      units: { inputTokens: 300 },
    });
  });
});

describe("moderation events", () => {
  const block = (o: { userId: ObjectId; workspaceId: ObjectId }, text = "x".repeat(500)) => ({
    ...o,
    inputKind: "topic" as const,
    decision: "block" as const,
    category: "illegal" as const,
    reason: "Videos can't give instructions for making weapons.",
    text,
    model: "stub",
  });

  it("keeps every block with a 200-character excerpt, and allowed inputs only when sampled", async () => {
    const o = await owner();
    expect(await recordModeration(db(), block(o))).toEqual({ recorded: true, flagged: false });
    const allow = {
      ...o,
      inputKind: "topic" as const,
      decision: "allow" as const,
      text: "UPI",
      model: "stub",
    };
    expect((await recordModeration(db(), allow, { sample: () => false })).recorded).toBe(false);
    expect((await recordModeration(db(), allow, { sample: () => true })).recorded).toBe(true);

    const rows = await workspaceCollection(db(), "moderation_events")
      .find({ workspaceId: o.workspaceId })
      .toArray();
    expect(rows.map((r) => r.decision).sort()).toEqual(["allow", "block"]);
    expect(rows.find((r) => r.decision === "block")?.excerpt).toHaveLength(200);
  });

  it("flags the workspace on the third block in 24 hours, once", async () => {
    const o = await owner();
    const day = (h: number) => new Date(Date.UTC(2026, 10, 14, h));
    expect((await recordModeration(db(), block(o), { now: day(0) })).flagged).toBe(false);
    expect((await recordModeration(db(), block(o), { now: day(2) })).flagged).toBe(false);
    expect((await recordModeration(db(), block(o), { now: day(3) })).flagged).toBe(true);
    expect((await recordModeration(db(), block(o), { now: day(4) })).flagged).toBe(false);
    const workspace = await workspaceCollection(db(), "workspaces").findOne({ _id: o.workspaceId });
    expect(workspace?.flags.reviewReason).toBe("3 blocked requests in 24 hours");
  });

  it("doesn't count blocks older than 24 hours", async () => {
    const o = await owner();
    await recordModeration(db(), block(o), { now: new Date("2026-11-10T00:00:00Z") });
    await recordModeration(db(), block(o), { now: new Date("2026-11-14T00:00:00Z") });
    expect(
      (await recordModeration(db(), block(o), { now: new Date("2026-11-14T01:00:00Z") })).flagged,
    ).toBe(false);
  });
});
