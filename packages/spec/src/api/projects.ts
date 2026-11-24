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
  tone,
  videoFormat,
  voiceGender,
  voiceSpeed,
} from "../collections/common.ts";
import type { Job } from "../collections/job.ts";
import { type Project, projectStage, videoType, wizardStep } from "../collections/project.ts";
import type { Workspace } from "../collections/workspace.ts";
import type { SpecIssueCode } from "../video/checks.ts";
import { type VideoSpec, videoSpec } from "../video/schema.ts";
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
  draft: z.object({ spec: videoSpec.nullable(), rev: z.int(), updatedAt: iso }),
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
      // The rules in DB §6 (`specIssues`). Text over its limit is a shape error (400), and the
      // editor's fields stop at the limit, so there is no TEXT_TOO_LONG (decision log, 17 Nov).
      code: z.enum([
        "TRIGGER_NOT_IN_NARRATION",
        "TRIGGER_OUT_OF_ORDER",
        "DUPLICATE_SCENE_ID",
        "DURATION_OUT_OF_RANGE",
        "NARRATION_MISMATCH",
      ] satisfies SpecIssueCode[]),
      /** Where in the scene's content, e.g. "items[2].trigger". */
      path: z.string().optional(),
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

/**
 * The whole draft spec (API §5). A wrong shape (types, missing fields, text over its limit,
 * more than 10 scenes) is `400 VALIDATION_FAILED` and nothing is saved; the rules zod can't
 * express come back as `issues`.
 */
export const saveDraftInput = z.object({
  baseRev: z.int().min(0),
  spec: videoSpec,
});
export type SaveDraftInput = z.infer<typeof saveDraftInput>;

/** `POST /projects/{id}/storyboard` (API §6): replacing a storyboard needs `overwrite`. */
export const requestStoryboardInput = z.object({ overwrite: z.boolean().optional() }).default({});
export type RequestStoryboardInput = z.infer<typeof requestStoryboardInput>;

/** `POST /projects/{id}/generate` (API §7): over the draft rev the person sees. */
export const generateInput = z.object({ baseRev: z.int().min(0) });
export type GenerateInput = z.infer<typeof generateInput>;

/**
 * `POST /projects/{id}/narration` (API §7): record some scenes again; by default every scene
 * without a current recording.
 */
export const updateNarrationInput = z.object({
  baseRev: z.int().min(0),
  sceneIds: z.array(z.string().min(1).max(40)).min(1).max(10).optional(),
});
export type UpdateNarrationInput = z.infer<typeof updateNarrationInput>;

export const takeLeaseInput = z.object({ takeover: z.boolean().optional() }).default({});
/** The lease release (a beacon): the tab's editor id, and its last unsaved change if any (F22). */
export const releaseLeaseInput = z.object({
  editorId: z.string().min(1).max(100),
  draft: saveDraftInput.optional(),
});

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

/**
 * The draft spec as the API shows it: a full `VideoSpec`. The collection's validator only
 * checks the top level (DB §13), so a stored spec that doesn't parse (written before F17) is
 * shown as no storyboard, and step 3 offers to build one.
 */
export function draftSpec(project: Pick<Project, "draft">): VideoSpec | null {
  if (!project.draft.spec) return null;
  const parsed = videoSpec.safeParse(project.draft.spec);
  return parsed.success ? parsed.data : null;
}

/** Background music starts at this volume, ducked under the narrator (DB §6). */
export const defaultMusicVolume = 0.25;

/**
 * The spec fields the project's settings own: format, language, narrator (with its ElevenLabs
 * voice id), theme and music. A new storyboard takes them from the settings, and so does every
 * draft save, whatever the client sent: they change only through the settings (PATCH), which
 * keep the draft in step. Music keeps its stored volume while the track is the same.
 */
export function specSettings(
  settings: Project["settings"],
  voiceIds: Record<"female" | "male", string>,
  storedMusic: VideoSpec["music"] = null,
): Pick<VideoSpec, "format" | "language" | "voice" | "theme" | "music"> {
  const trackId = settings.musicTrackId;
  return {
    format: settings.format,
    language: settings.language,
    voice: {
      gender: settings.voiceGender,
      voiceId: voiceIds[settings.voiceGender],
      model: "eleven_multilingual_v2",
      speed: settings.voiceSpeed,
    },
    theme: { palette: settings.palette, captionStyle: settings.captionStyle },
    music: trackId
      ? storedMusic?.trackId === trackId
        ? storedMusic
        : { trackId, volume: defaultMusicVolume, duck: true }
      : null,
  };
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
  /** Signed playback URLs for the narration the draft plays, by asset id (API §7). */
  audio?: Record<string, { url: string; expiresAt: Date }>;
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
      spec: draftSpec(project),
      rev: project.draft.rev,
      updatedAt: project.draft.updatedAt.toISOString(),
    },
    audio: Object.fromEntries(
      Object.entries(extras.audio ?? {}).map(([id, link]) => [
        id,
        { url: link.url, expiresAt: link.expiresAt.toISOString() },
      ]),
    ),
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
