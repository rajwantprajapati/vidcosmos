// projects, project_versions, chat_messages (DB §5).
import { z } from "zod";
import {
  audienceLevel,
  captionStyle,
  count,
  date,
  errorInfo,
  language,
  lengthSec,
  objectId,
  palette,
  schemaVersion,
  storedRevisionOperation,
  storedVideoSpec,
  tone,
  videoFormat,
  voiceGender,
  voiceSpeed,
} from "./common.ts";

export const projectStage = z.enum(["draft", "generating", "ready", "revising", "failed"]);
export const wizardStep = z.enum(["idea", "angles", "script", "storyboard", "video"]);

export const projectSettings = z.object({
  format: videoFormat,
  language,
  voiceGender,
  voiceSpeed,
  tone,
  audienceLevel,
  lengthSec,
  palette,
  captionStyle,
  musicTrackId: z.string().nullable(),
});

export const angle = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  hook: z.string().min(1),
  outline: z.array(z.string()),
});

/** The kind of video chosen in step 1 (decision D1). */
export const videoType = z.enum([
  "explainer",
  "product_ad",
  "story",
  "travel",
  "quote",
  "music_visual",
]);
export type VideoType = z.infer<typeof videoType>;

/** How each video type is written in the interface. */
export const videoTypeLabels: Record<VideoType, string> = {
  explainer: "Explainer",
  product_ad: "Product ad",
  story: "Story",
  travel: "Travel",
  quote: "Quote",
  music_visual: "Music visual",
};

export const projectIdea = z.object({
  topic: z.string().min(3).max(500),
  /** Missing on projects made before D1: read as "explainer". */
  videoType: videoType.optional(),
  notes: z.string().max(5000).optional(),
  goal: z.enum(["explain", "teach", "summarise", "promote"]).optional(),
  angles: z.array(angle).max(5),
  selectedAngleId: z.string().optional(),
});

export const projectScript = z.object({
  title: z.string().min(1).max(100),
  hook: z.string(),
  text: z.string().max(1800),
  wordCount: count,
  estDurationSec: z.number().min(0),
  source: z.enum(["ai", "user", "ai_edited"]),
  updatedAt: date,
});

export const projectSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  createdBy: objectId,
  title: z.string().min(1).max(100),
  stage: projectStage,
  wizardStep,
  settings: projectSettings,
  idea: projectIdea,
  script: projectScript.nullable(),
  draft: z.object({
    spec: storedVideoSpec.nullable(),
    rev: count,
    updatedAt: date,
    updatedBy: objectId,
  }),
  currentVersion: z.int().min(1).nullable(),
  countedAt: date.nullable(),
  revisionsUsed: count,
  generationsUsed: count,
  stageHashes: z.object({
    idea: z.string().optional(),
    script: z.string().optional(),
  }),
  activeJobId: objectId.nullable(),
  lease: z
    .object({
      holderSessionId: z.string().min(1),
      userId: objectId,
      expiresAt: date,
    })
    .nullable(),
  thumbnailKey: z.string().nullable(),
  lastExportId: objectId.nullable(),
  lastOpenedAt: date,
  createdAt: date,
  updatedAt: date,
  deletedAt: date.nullable(),
});
export type Project = z.infer<typeof projectSchema>;

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

export const projectVersionSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  projectId: objectId,
  number: z.int().min(1),
  spec: storedVideoSpec,
  specHash: sha256Hex,
  reason: z.enum(["generate", "apply", "manual", "restore"]),
  summary: z.string().max(200),
  restoredFrom: z.int().min(1).optional(),
  chatMessageId: objectId.optional(),
  jobId: objectId.optional(),
  durationMs: count,
  sceneCount: count,
  createdBy: objectId,
  createdAt: date,
});
export type ProjectVersion = z.infer<typeof projectVersionSchema>;

export const chatScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("video") }),
  z.object({ kind: z.literal("scene"), sceneId: z.string().min(1) }),
]);

export const chatProposal = z.object({
  summary: z.string().min(1),
  operations: z.array(storedRevisionOperation),
  affectedSceneIds: z.array(z.string()),
  regeneratesVoice: z.boolean(),
  estDurationSec: z.number().min(0),
  warnings: z.array(z.string()),
  baseRev: count,
});

export const chatMessageSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  projectId: objectId,
  role: z.enum(["user", "assistant"]),
  /** User messages are capped at 2,000 characters by the API; replies can be longer. */
  content: z.string(),
  scope: chatScope,
  kind: z.enum(["message", "proposal", "clarify", "unsupported", "error"]),
  proposal: chatProposal.optional(),
  status: z.enum(["proposed", "applied", "dismissed", "stale", "failed"]).optional(),
  appliedVersion: z.int().min(1).optional(),
  jobId: objectId.optional(),
  error: errorInfo.optional(),
  createdBy: objectId.optional(),
  createdAt: date,
  updatedAt: date,
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
