// What the script jobs read and write besides the job (API §6): the project's idea, settings
// and script, the job's input, the saved script, and moderation decisions. Plain JSON in and
// out, so steps can memoise it; tests use an in-memory version.
import {
  getJob,
  ideaHash,
  ObjectId,
  readScriptInputs,
  recordModeration,
  saveScript,
  type Db,
} from "@vidcosmos/db";
import type { ModerationResult, RewriteRequest, ScriptRequest } from "@vidcosmos/pipeline";
import { rewriteScriptInput, singleLine } from "@vidcosmos/spec/api";
import type { Project } from "@vidcosmos/spec/collections";
import type { EventData } from "@vidcosmos/spec/events";
import { z } from "zod";

export type ScriptJob = EventData<"video/script.requested">;
export type RewriteJob = EventData<"video/script.rewrite.requested">;
type AnyScriptJob = ScriptJob | RewriteJob;

/** Everything `writeScript` needs, plus who asked and what to save alongside the script. */
export type ScriptInputs = {
  userId: string;
  request: ScriptRequest;
  /** `stageHashes.idea` for the script: the idea it was written from. */
  ideaHash: string;
  /** The title a project starts with (its topic); replaced by the script's title. */
  autoTitle: string;
  /** The angle written from: it becomes the picked one. */
  angleId?: string;
  /** The script when the job was asked for (null: none); saved only over that. */
  expectText: string | null;
};

/** The script before the rewrite (kept in the job's input) and how to rewrite it. */
export type RewriteInputs = {
  userId: string;
  request: RewriteRequest;
  previous: { title: string; hook: string; text: string; source: ScriptSource };
};

type ScriptSource = NonNullable<Project["script"]>["source"];

export type ScriptToSave = {
  title: string;
  hook: string;
  text: string;
  wordCount: number;
  estDurationSec: number;
  source: ScriptSource;
};

export type ScriptStore = {
  /** Null when the project is gone (deleted, or not this workspace's). */
  loadScript(job: ScriptJob): Promise<ScriptInputs | null>;
  loadRewrite(job: RewriteJob): Promise<RewriteInputs | null>;
  save(
    job: AnyScriptJob,
    script: ScriptToSave,
    options: {
      ideaHash?: string;
      autoTitle?: string;
      angleId?: string;
      expectText?: string | null;
    },
  ): Promise<"saved" | "changed" | "gone">;
  recordModeration(job: AnyScriptJob, userId: string, result: ModerationResult): Promise<void>;
};

/** What the script route keeps in the job's input. */
export const scriptJobInput = z.object({
  angleId: z.string().nullable().optional(),
  instructions: z.string().optional(),
  previousText: z.string().nullable().optional(),
});

/** What the rewrite route keeps in the job's input: the request and the script before it. */
export const rewriteJobInput = rewriteScriptInput.and(
  z.object({
    previous: z.object({
      title: z.string(),
      hook: z.string(),
      text: z.string(),
      source: z.enum(["ai", "user", "ai_edited"]),
    }),
  }),
);

const ids = (job: AnyScriptJob) => ({
  workspaceId: new ObjectId(job.workspaceId),
  projectId: new ObjectId(job.projectId),
  jobId: new ObjectId(job.jobId),
});

export function mongoScriptStore(getDb: () => Db): ScriptStore {
  return {
    async loadScript(job) {
      const { workspaceId, projectId, jobId } = ids(job);
      const project = await readScriptInputs(getDb(), workspaceId, projectId);
      if (!project) return null;
      const stored = await getJob(getDb(), workspaceId, jobId);
      const input = scriptJobInput.parse(stored.input);
      const { idea, settings } = project;
      const angle = input.angleId
        ? idea.angles.find((candidate) => candidate.id === input.angleId)
        : undefined;
      return {
        userId: stored.userId.toHexString(),
        request: {
          topic: idea.topic,
          ...(idea.notes ? { notes: idea.notes } : {}),
          videoType: idea.videoType ?? "explainer",
          ...(idea.goal ? { goal: idea.goal } : {}),
          ...(angle
            ? { angle: { title: angle.title, hook: angle.hook, outline: angle.outline } }
            : {}),
          language: settings.language,
          audienceLevel: settings.audienceLevel,
          tone: settings.tone,
          lengthSec: settings.lengthSec,
          ...(input.instructions ? { instructions: input.instructions } : {}),
        },
        ideaHash: ideaHash({ ...idea, selectedAngleId: angle?.id }),
        autoTitle: singleLine(idea.topic).slice(0, 100).trim(),
        ...(angle ? { angleId: angle.id } : {}),
        expectText: input.previousText ?? null,
      };
    },
    async loadRewrite(job) {
      const { workspaceId, projectId, jobId } = ids(job);
      const project = await readScriptInputs(getDb(), workspaceId, projectId);
      if (!project) return null;
      const stored = await getJob(getDb(), workspaceId, jobId);
      const input = rewriteJobInput.parse(stored.input);
      const { settings } = project;
      return {
        userId: stored.userId.toHexString(),
        request: {
          script: input.previous.text,
          instruction: input.instruction,
          ...(input.custom ? { custom: input.custom } : {}),
          ...(input.selection ? { selection: input.selection } : {}),
          language: settings.language,
          audienceLevel: settings.audienceLevel,
          tone: settings.tone,
          lengthSec: settings.lengthSec,
        },
        previous: input.previous,
      };
    },
    save: (job, script, options) =>
      saveScript(getDb(), ids(job), {
        script: { ...script, updatedAt: new Date() },
        ...options,
      }),
    async recordModeration(job, userId, result) {
      const { workspaceId, projectId } = ids(job);
      await recordModeration(getDb(), {
        workspaceId,
        projectId,
        userId: new ObjectId(userId),
        inputKind: result.decision === "block" ? result.input.kind : "script",
        decision: result.decision,
        ...(result.decision === "block"
          ? { category: result.category, reason: result.reason }
          : {}),
        text: result.decision === "block" ? result.input.text : "",
        model: result.model,
      });
    },
  };
}
