// What the storyboard job reads and writes besides the job (API §6): the script and settings,
// the job's input, the saved storyboard, and moderation decisions. Plain JSON in and out, so
// steps can memoise it; tests use an in-memory version.
import {
  getJob,
  ObjectId,
  readStoryboardInputs,
  recordModeration,
  saveStoryboard,
  type Db,
} from "@vidcosmos/db";
import type { ModerationResult, StoryboardRequest } from "@vidcosmos/pipeline";
import { specSettings } from "@vidcosmos/spec/api";
import type { EventData } from "@vidcosmos/spec/events";
import type { VideoSpec } from "@vidcosmos/spec/video";
import { z } from "zod";

export type StoryboardJob = EventData<"video/storyboard.requested">;

/** Everything `buildStoryboard` needs, plus who asked and what to save over. */
export type StoryboardInputs = {
  userId: string;
  request: StoryboardRequest;
  /** The draft's rev when the job was asked for: saved only over that draft. */
  baseRev: number;
};

export type StoryboardSaved = { saved: true; rev: number } | { saved: false };

export type StoryboardStore = {
  /** Null when the project is gone (deleted, or not this workspace's). */
  load(job: StoryboardJob): Promise<StoryboardInputs | null>;
  save(job: StoryboardJob, spec: VideoSpec, inputs: StoryboardInputs): Promise<StoryboardSaved>;
  recordModeration(job: StoryboardJob, userId: string, result: ModerationResult): Promise<void>;
};

/** What the storyboard route keeps in the job's input. */
export const storyboardJobInput = z.object({
  scriptText: z.string().min(1),
  baseRev: z.int().min(0),
});

const ids = (job: StoryboardJob) => ({
  workspaceId: new ObjectId(job.workspaceId),
  projectId: new ObjectId(job.projectId),
  jobId: new ObjectId(job.jobId),
});

export function mongoStoryboardStore(
  getDb: () => Db,
  voiceIds: () => Record<"female" | "male", string>,
): StoryboardStore {
  return {
    async load(job) {
      const { workspaceId, projectId, jobId } = ids(job);
      const project = await readStoryboardInputs(getDb(), workspaceId, projectId);
      if (!project) return null;
      const stored = await getJob(getDb(), workspaceId, jobId);
      const input = storyboardJobInput.parse(stored.input);
      const { settings } = project;
      return {
        userId: stored.userId.toHexString(),
        request: {
          title: project.script?.title ?? project.title,
          script: input.scriptText,
          lengthSec: settings.lengthSec,
          videoType: project.idea.videoType ?? "explainer",
          audienceLevel: settings.audienceLevel,
          ...specSettings(settings, voiceIds()),
        },
        baseRev: input.baseRev,
      };
    },
    async save(job, spec, inputs) {
      const result = await saveStoryboard(getDb(), ids(job), {
        spec,
        scriptText: inputs.request.script,
        baseRev: inputs.baseRev,
        userId: new ObjectId(inputs.userId),
      });
      return result.saved ? result : { saved: false };
    },
    async recordModeration(job, userId, result) {
      const { workspaceId, projectId } = ids(job);
      await recordModeration(getDb(), {
        workspaceId,
        projectId,
        userId: new ObjectId(userId),
        inputKind: result.decision === "block" ? result.input.kind : "scene_text",
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
