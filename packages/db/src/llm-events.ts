// What AI calls cost and what moderation decided (DB §4 `usage_events`, `moderation_events`;
// SDD §15). One usage event per provider call, retries included, with raw units and the cost
// in integer micro-dollars from a versioned price table. Moderation keeps every block (and a
// 1% sample of allowed inputs, to check for misses); three blocks in 24 hours flag the
// workspace for an admin to review.
import type { ModerationEvent, UsageEvent } from "@vidcosmos/spec/collections";
import { type Db, ObjectId } from "mongodb";
import { workspaceCollection } from "./scoped.ts";

export type NewUsageEvent = Omit<UsageEvent, "_id" | "schemaVersion" | "createdAt">;

export async function recordUsage(db: Db, event: NewUsageEvent, now = new Date()): Promise<void> {
  await workspaceCollection(db, "usage_events").insertOne({
    _id: new ObjectId(),
    schemaVersion: 1,
    ...event,
    createdAt: now,
  });
}

/** Blocks in this window that flag a workspace for review (DB §4). */
export const moderationReview = { blocks: 3, windowMs: 24 * 60 * 60 * 1000 } as const;

/** Share of allowed inputs kept, to check for false negatives (DB §4). */
export const allowedSampleRate = 0.01;

export type NewModerationEvent = {
  workspaceId: ObjectId;
  userId: ObjectId;
  projectId?: ObjectId;
  inputKind: ModerationEvent["inputKind"];
  decision: ModerationEvent["decision"];
  category?: ModerationEvent["category"];
  reason?: string;
  /** The checked text; only its first 200 characters are kept. */
  text: string;
  model: string;
};

/**
 * Records a moderation decision: every block, and allowed inputs only when `sample` says so.
 * Returns whether this block flagged the workspace for review.
 */
export async function recordModeration(
  db: Db,
  event: NewModerationEvent,
  options: { now?: Date; sample?: () => boolean } = {},
): Promise<{ recorded: boolean; flagged: boolean }> {
  const now = options.now ?? new Date();
  const sample = options.sample ?? (() => Math.random() < allowedSampleRate);
  if (event.decision === "allow" && !sample()) return { recorded: false, flagged: false };

  const { text, ...rest } = event;
  await workspaceCollection(db, "moderation_events").insertOne({
    _id: new ObjectId(),
    schemaVersion: 1,
    ...rest,
    ...(event.reason ? { reason: event.reason.slice(0, 200) } : {}),
    excerpt: text.slice(0, 200),
    createdAt: now,
  });
  if (event.decision !== "block") return { recorded: true, flagged: false };

  const blocks = await workspaceCollection(db, "moderation_events").countDocuments({
    workspaceId: event.workspaceId,
    decision: "block",
    createdAt: { $gt: new Date(now.getTime() - moderationReview.windowMs) },
  });
  if (blocks < moderationReview.blocks) return { recorded: true, flagged: false };
  const flagged = await workspaceCollection(db, "workspaces").updateOne(
    { _id: event.workspaceId, "flags.reviewReason": { $exists: false } },
    {
      $set: {
        "flags.reviewReason": `${moderationReview.blocks} blocked requests in 24 hours`,
        updatedAt: now,
      },
    },
  );
  return { recorded: true, flagged: flagged.modifiedCount === 1 };
}
