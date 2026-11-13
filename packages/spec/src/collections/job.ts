// jobs, assets, exports (DB §7).
import { z } from "zod";
import {
  count,
  date,
  errorInfo,
  language,
  objectId,
  schemaVersion,
  videoFormat,
  wordTiming,
} from "./common.ts";

export const jobType = z.enum([
  "ideas",
  "script",
  "script_rewrite",
  "storyboard",
  "generate",
  "scene_retry",
  "revise_propose",
  "revise_apply",
  "export",
  "caption",
  "publish",
  "account_delete",
  // Development only: the fake job behind /dev/jobs (F11). Never created in production.
  "demo",
]);

export const jobStatus = z.enum([
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export const jobStage = z.enum([
  "moderation",
  "llm",
  "validate",
  "narration",
  "timing",
  "save",
  "render",
  "upload",
  "ig_container",
  "ig_processing",
  "ig_publish",
]);

export const jobSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  /** Null for account-level jobs. */
  projectId: objectId.nullable(),
  userId: objectId,
  type: jobType,
  status: jobStatus,
  stage: jobStage.optional(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  scenes: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        status: z.enum(["pending", "running", "done", "failed", "skipped"]),
        attempts: count,
        error: errorInfo.optional(),
      }),
    )
    .optional(),
  /** Small and type-specific; each job type validates its own input (never a whole spec). */
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).optional(),
  error: errorInfo.extend({ retryable: z.boolean(), stage: z.string().optional() }).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
  inngest: z.object({ eventId: z.string().min(1), runId: z.string().optional() }),
  usage: z.object({ reserved: z.boolean(), committed: z.boolean(), released: z.boolean() }),
  attempts: count,
  cancelRequestedAt: date.optional(),
  heartbeatAt: date.optional(),
  startedAt: date.optional(),
  finishedAt: date.optional(),
  /** finishedAt + 180 days; a TTL index removes the job then. */
  expiresAt: date.optional(),
  createdAt: date,
  updatedAt: date,
});
export type Job = z.infer<typeof jobSchema>;

export const assetSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  kind: z.literal("narration"),
  /** narrationHash (DB §6). */
  hash: z.string().min(1),
  r2Key: z.string().min(1),
  mime: z.literal("audio/mpeg"),
  bytes: count,
  durationMs: count,
  meta: z.object({
    text: z.string(),
    language,
    voiceId: z.string().min(1),
    model: z.string().min(1),
    speed: z.number(),
    characters: count,
    words: z.array(wordTiming),
  }),
  createdAt: date,
  lastUsedAt: date,
});
export type Asset = z.infer<typeof assetSchema>;

const fileRef = z.object({ key: z.string().min(1), bytes: count });

export const exportSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  projectId: objectId,
  versionNumber: z.int().min(1),
  specHash: z.string().min(1),
  format: videoFormat,
  resolution: z.enum(["1080p", "720p"]),
  width: z.int().min(1),
  height: z.int().min(1),
  status: z.enum(["queued", "rendering", "uploading", "ready", "failed", "expired"]),
  /** False once failed or expired, which frees the render-cache slot. */
  active: z.boolean(),
  jobId: objectId,
  files: z.object({
    mp4: fileRef.optional(),
    mp3: fileRef.optional(),
    cover: z.object({ key: z.string().min(1), atMs: count }).optional(),
    srt: z.object({ key: z.string().min(1) }).optional(),
  }),
  durationMs: count,
  render: z.object({ setupMs: count, renderMs: count, uploadMs: count }).optional(),
  captionDraft: z.string().max(2200).optional(),
  error: errorInfo.optional(),
  downloadCount: count,
  createdBy: objectId,
  createdAt: date,
  readyAt: date.optional(),
  expiresAt: date.optional(),
});
export type Export = z.infer<typeof exportSchema>;
