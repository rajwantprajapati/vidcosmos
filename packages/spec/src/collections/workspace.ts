// workspaces, usage_events, moderation_events (DB §4).
import { z } from "zod";
import {
  audienceLevel,
  captionStyle,
  count,
  date,
  language,
  lengthSec,
  objectId,
  palette,
  schemaVersion,
  tone,
  videoFormat,
  voiceGender,
} from "./common.ts";

/** IST month, e.g. `2026-11`. */
const periodKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
/** IST day, e.g. `2026-11-11`. */
const dayKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

export const workspaceDefaults = z.object({
  format: videoFormat,
  language,
  voiceGender,
  tone,
  audienceLevel,
  lengthSec,
  palette,
  captionStyle,
  musicTrackId: z.string().nullable(),
});

export const workspaceLimits = z.object({
  videosPerMonth: count,
  revisionsPerVideo: count,
  generationsPerVideo: count,
  exportsPerDay: count,
  concurrentJobs: count,
});

export const workspaceUsage = z.object({
  periodKey,
  periodStart: date,
  videosUsed: count,
  videosReserved: count,
  exportsDayKey: dayKey,
  exportsToday: count,
});

export const workspaceSchema = z.object({
  _id: objectId,
  schemaVersion,
  ownerId: objectId,
  name: z.string().min(1).max(60),
  plan: z.literal("free"),
  defaults: workspaceDefaults,
  limits: workspaceLimits,
  usage: workspaceUsage,
  flags: z.object({
    blocked: z.boolean(),
    blockedReason: z.string().optional(),
    reviewReason: z.string().optional(),
  }),
  createdAt: date,
  updatedAt: date,
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const usageEventSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  projectId: objectId.optional(),
  jobId: objectId.optional(),
  userId: objectId.optional(),
  provider: z.enum(["gemini", "anthropic", "elevenlabs", "vercel_sandbox", "r2"]),
  operation: z.enum([
    "ideas",
    "script",
    "storyboard",
    "revise",
    "caption",
    "moderation",
    "narration",
    "render",
    "storage",
  ]),
  model: z.string().optional(),
  units: z.object({
    inputTokens: count.optional(),
    outputTokens: count.optional(),
    characters: count.optional(),
    sandboxSeconds: z.number().min(0).optional(),
    bytes: count.optional(),
  }),
  cached: z.boolean(),
  /** Integer micro-USD: 1 USD = 1,000,000. */
  costMicroUsd: count,
  priceVersion: z.string().min(1),
  attempt: z.int().min(1),
  createdAt: date,
});
export type UsageEvent = z.infer<typeof usageEventSchema>;

export const moderationEventSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  userId: objectId,
  projectId: objectId.optional(),
  inputKind: z.enum(["topic", "notes", "script", "scene_text", "chat", "caption"]),
  decision: z.enum(["allow", "block", "review"]),
  category: z
    .enum([
      "sexual",
      "minors",
      "violence",
      "hate",
      "self_harm",
      "illegal",
      "misinformation",
      "other",
    ])
    .optional(),
  reason: z.string().max(200).optional(),
  excerpt: z.string().max(200),
  model: z.string().min(1),
  createdAt: date,
});
export type ModerationEvent = z.infer<typeof moderationEventSchema>;
