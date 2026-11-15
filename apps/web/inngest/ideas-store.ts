// What the ideas step reads and writes besides the job (API §6): the project's idea and
// settings, the person's usual topics, the angles, and moderation decisions. Plain JSON in and
// out, so steps can memoise it; tests use an in-memory version.
import {
  getJob,
  ObjectId,
  readAppUserFields,
  readIdeaInputs,
  recordModeration,
  saveAngles,
  type Db,
} from "@vidcosmos/db";
import type { IdeasRequest, ModerationResult } from "@vidcosmos/pipeline";
import type { Project } from "@vidcosmos/spec/collections";
import type { EventData } from "@vidcosmos/spec/events";

export type IdeasJob = EventData<"video/ideas.requested">;

/** Everything `suggestAngles` needs except the count and steer, plus who asked. */
export type IdeasInputs = Omit<IdeasRequest, "count" | "steer"> & { userId: string };

export type IdeasStore = {
  /** Null when the project is gone (deleted, or not this workspace's). */
  load(job: IdeasJob): Promise<IdeasInputs | null>;
  /** False when the job no longer holds the project (cancelled or overtaken). */
  saveAngles(job: IdeasJob, angles: Project["idea"]["angles"]): Promise<boolean>;
  recordModeration(job: IdeasJob, userId: string, result: ModerationResult): Promise<void>;
};

const ids = (job: IdeasJob) => ({
  workspaceId: new ObjectId(job.workspaceId),
  projectId: new ObjectId(job.projectId),
  jobId: new ObjectId(job.jobId),
});

export function mongoIdeasStore(getDb: () => Db): IdeasStore {
  return {
    async load(job) {
      const { workspaceId, projectId, jobId } = ids(job);
      const project = await readIdeaInputs(getDb(), workspaceId, projectId);
      if (!project) return null;
      const { userId } = await getJob(getDb(), workspaceId, jobId);
      const fields = await readAppUserFields(getDb(), userId);
      const { idea, settings } = project;
      return {
        userId: userId.toHexString(),
        topic: idea.topic,
        ...(idea.notes ? { notes: idea.notes } : {}),
        videoType: idea.videoType ?? "explainer",
        ...(idea.goal ? { goal: idea.goal } : {}),
        language: settings.language,
        audienceLevel: settings.audienceLevel,
        tone: settings.tone,
        lengthSec: settings.lengthSec,
        format: settings.format,
        ...(fields?.onboarding?.topicArea ? { topicArea: fields.onboarding.topicArea } : {}),
      };
    },
    saveAngles: (job, angles) => saveAngles(getDb(), ids(job), angles),
    async recordModeration(job, userId, result) {
      const { workspaceId, projectId } = ids(job);
      await recordModeration(getDb(), {
        workspaceId,
        projectId,
        userId: new ObjectId(userId),
        inputKind: result.decision === "block" ? result.input.kind : "topic",
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
