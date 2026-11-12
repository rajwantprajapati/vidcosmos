// Projects API (API §3 Project, §5): request schemas, response schemas and the mappers that
// build responses from `projects` documents. Responses never carry internal fields
// (workspaceId, lease session ids, R2 keys).
import { z } from "zod";
import {
  audienceLevel,
  captionStyle,
  language,
  lengthSec,
  palette,
  storedVideoSpec,
  tone,
  videoFormat,
  voiceGender,
  voiceSpeed,
} from "../collections/common.ts";
import type { Job } from "../collections/job.ts";
import { type Project, projectStage, videoType, wizardStep } from "../collections/project.ts";
import type { Workspace } from "../collections/workspace.ts";
import { controlCharacterMessage, isPlainText, stripControlCharacters } from "./text.ts";

const id = z.string().regex(/^[0-9a-f]{24}$/);
const iso = z.iso.datetime();
const signedUrl = z.object({ url: z.string(), expiresAt: iso });
const goal = z.enum(["explain", "teach", "summarise", "promote"]);

export const projectSettingsDto = z.object({
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
export type ProjectSettingsDto = z.infer<typeof projectSettingsDto>;

export const projectSummaryDto = z.object({
  id,
  title: z.string(),
  videoType,
  stage: projectStage,
  wizardStep,
  language,
  lengthSec,
  format: videoFormat,
  durationMs: z.int().nullable(),
  thumbnail: signedUrl.nullable(),
  currentVersion: z.int().nullable(),
  activeJob: z
    .object({ id, type: z.string(), status: z.string(), progress: z.number() })
    .nullable(),
  lastExport: z.object({ id, status: z.string(), readyAt: iso.nullable() }).nullable(),
  nextPost: z.object({ id, status: z.string(), scheduledFor: iso.nullable() }).nullable(),
  deletedAt: iso.nullable(),
  createdAt: iso,
  updatedAt: iso,
});
export type ProjectSummaryDto = z.infer<typeof projectSummaryDto>;

export const leaseDto = z.object({ heldByMe: z.boolean(), holderName: z.string(), expiresAt: iso });
export type LeaseDto = z.infer<typeof leaseDto>;

export const projectDetailDto = projectSummaryDto.extend({
  settings: projectSettingsDto,
  idea: z.object({
    topic: z.string(),
    videoType,
    notes: z.string().nullable(),
    goal: goal.nullable(),
    angles: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        hook: z.string(),
        outline: z.array(z.string()),
      }),
    ),
    selectedAngleId: z.string().nullable(),
  }),
  script: z
    .object({
      title: z.string(),
      hook: z.string(),
      text: z.string(),
      wordCount: z.int(),
      estDurationSec: z.number(),
      source: z.enum(["ai", "user", "ai_edited"]),
      updatedAt: iso,
    })
    .nullable(),
  // The full VideoSpec schema arrives in F16; until then the stored top-level shape.
  draft: z.object({ spec: storedVideoSpec.nullable(), rev: z.int(), updatedAt: iso }),
  audio: z.record(id, signedUrl),
  stale: z.object({ script: z.boolean(), storyboard: z.boolean() }),
  lease: leaseDto.nullable(),
  counters: z.object({
    revisionsUsed: z.int(),
    revisionsMax: z.int(),
    generationsUsed: z.int(),
    generationsMax: z.int(),
  }),
});
export type ProjectDetailDto = z.infer<typeof projectDetailDto>;

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const draftSavedDto = z.object({
  rev: z.int(),
  updatedAt: iso,
  staleSceneIds: z.array(z.string()),
  issues: z.array(
    z.object({
      sceneId: z.string().nullable(),
      code: z.enum(["TRIGGER_NOT_IN_NARRATION", "TEXT_TOO_LONG", "DURATION_OUT_OF_RANGE"]),
      message: z.string(),
    }),
  ),
});
export type DraftSavedDto = z.infer<typeof draftSavedDto>;

// ---- Requests ----

/** Topic, notes and titles: plain text, trimmed. */
const plain = (multiline: boolean) => [isPlainText(multiline), controlCharacterMessage] as const;
const topic = z
  .string()
  .trim()
  .min(3)
  .max(500)
  .refine(...plain(true));
const notes = z
  .string()
  .trim()
  .max(5000)
  .refine(...plain(true));
const title = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(...plain(false));

export const createProjectInput = z.object({
  topic,
  videoType: videoType.optional(),
  notes: notes.optional(),
  goal: goal.optional(),
  settings: projectSettingsDto.partial().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectInput>;

export const updateProjectInput = z
  .object({
    title: title.optional(),
    wizardStep: wizardStep.optional(),
    settings: projectSettingsDto.partial().optional(),
    idea: z
      .object({
        topic: topic.optional(),
        videoType: videoType.optional(),
        notes: notes.nullable().optional(),
        goal: goal.nullable().optional(),
        selectedAngleId: z.string().min(1).nullable().optional(),
      })
      .optional(),
    script: z
      .object({
        title: title.optional(),
        hook: z
          .string()
          .max(400)
          .refine(...plain(false))
          .optional(),
        text: z
          .string()
          .max(1800)
          .refine(...plain(true))
          .optional(),
      })
      .optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Send at least one field to change.",
  });
export type UpdateProjectInput = z.infer<typeof updateProjectInput>;

/** A video has at most 10 scenes (DB §6); more is a shape error and nothing is saved (API §5). */
export const maxScenes = 10;

export const saveDraftInput = z.object({
  baseRev: z.int().min(0),
  spec: storedVideoSpec.extend({ scenes: z.array(z.looseObject({})).max(maxScenes) }),
});
export type SaveDraftInput = z.infer<typeof saveDraftInput>;

export const takeLeaseInput = z.object({ takeover: z.boolean().optional() }).default({});
export const releaseLeaseInput = z.object({ editorId: z.string().min(1).max(100) });

/** A single value, or the same parameter repeated (`?stage=ready&stage=draft`). */
const repeatable = <T extends z.ZodType>(item: T) =>
  z.preprocess((value) => (Array.isArray(value) ? value : [value]), z.array(item).min(1));

export const listProjectsQuery = z.object({
  stage: repeatable(projectStage).optional(),
  // Cleaned, not refused: a stray control character must not break a search.
  q: z
    .string()
    .transform(stripControlCharacters)
    .pipe(z.string().trim().min(2).max(100))
    .optional(),
  language: language.optional(),
  format: repeatable(videoFormat).optional(),
  sort: z.enum(["updated", "created"]).default("updated"),
  trash: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  cursor: z.string().max(500).optional(),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;

// ---- Derived values ----

/** Words per second of narration (DB §5: en 2.5, hi 2.2). */
const wordsPerSecond = { en: 2.5, hi: 2.2 } as const;

export function scriptStats(text: string, lang: "en" | "hi") {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { wordCount, estDurationSec: Math.round((wordCount / wordsPerSecond[lang]) * 10) / 10 };
}

// ---- Mappers ----

type HasHex = { toHexString(): string };
const hex = (value: unknown) => (value as HasHex).toHexString();

/** The video's length once every scene has its timing; otherwise null. */
function specDurationMs(spec: Project["draft"]["spec"]): number | null {
  if (!spec || spec.scenes.length === 0) return null;
  let total = 0;
  for (const scene of spec.scenes) {
    const timing = (scene as { timing?: { durationMs?: unknown } | null }).timing;
    if (!timing || typeof timing.durationMs !== "number") return null;
    total += timing.durationMs;
  }
  return total;
}

export type SummaryExtras = {
  activeJob?: Pick<Job, "_id" | "type" | "status" | "progress"> | null;
};

export function toProjectSummaryDto(
  project: Project,
  extras: SummaryExtras = {},
): ProjectSummaryDto {
  const job = extras.activeJob;
  return {
    id: hex(project._id),
    title: project.title,
    videoType: project.idea.videoType ?? "explainer",
    stage: project.stage,
    wizardStep: project.wizardStep,
    language: project.settings.language,
    lengthSec: project.settings.lengthSec,
    format: project.settings.format,
    durationMs: specDurationMs(project.draft.spec),
    // Thumbnails (F12), exports (F26) and posts (F28) fill these in.
    thumbnail: null,
    currentVersion: project.currentVersion,
    activeJob: job
      ? { id: hex(job._id), type: job.type, status: job.status, progress: job.progress }
      : null,
    lastExport: null,
    nextPost: null,
    deletedAt: project.deletedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export type DetailExtras = SummaryExtras & {
  workspace: Pick<Workspace, "limits">;
  /** Who is asking: their lease holder id (session + editor tab), if any. */
  holder?: string;
  /** Display name of the lease holder. */
  leaseHolderName?: string;
  /** Which later steps are out of date (computed from the stage hashes on the server). */
  stale: { script: boolean; storyboard: boolean };
  now?: Date;
};

export function toProjectDetailDto(project: Project, extras: DetailExtras): ProjectDetailDto {
  const now = extras.now ?? new Date();
  const lease = project.lease && project.lease.expiresAt > now ? project.lease : null;
  const script = project.script;
  return {
    ...toProjectSummaryDto(project, extras),
    settings: { ...project.settings },
    idea: {
      topic: project.idea.topic,
      videoType: project.idea.videoType ?? "explainer",
      notes: project.idea.notes ?? null,
      goal: project.idea.goal ?? null,
      angles: project.idea.angles.map((a) => ({ ...a, outline: [...a.outline] })),
      selectedAngleId: project.idea.selectedAngleId ?? null,
    },
    script: script ? { ...script, updatedAt: script.updatedAt.toISOString() } : null,
    draft: {
      spec: project.draft.spec,
      rev: project.draft.rev,
      updatedAt: project.draft.updatedAt.toISOString(),
    },
    // Narration audio URLs arrive with storage and narration (F12, F20).
    audio: {},
    stale: extras.stale,
    lease: lease
      ? {
          heldByMe: extras.holder !== undefined && lease.holderSessionId === extras.holder,
          holderName: extras.leaseHolderName ?? "Someone",
          expiresAt: lease.expiresAt.toISOString(),
        }
      : null,
    counters: {
      revisionsUsed: project.revisionsUsed,
      revisionsMax: extras.workspace.limits.revisionsPerVideo,
      generationsUsed: project.generationsUsed,
      generationsMax: extras.workspace.limits.generationsPerVideo,
    },
  };
}
