// The storyboard step (API §6, DB §5): what a storyboard request may do, and saving the job's
// storyboard as the project's draft.
//
// Replacing a storyboard needs `overwrite` (`409 STAGE_INVALID`, `needs: 'overwrite'`), so
// the person is asked first. The job keeps the script and the draft's `rev` from when it was
// asked for, and saves only if neither changed since, so an edit made meanwhile is never lost.
// Saving records what the storyboard was made from (`stageHashes.script`), so a later script
// edit marks it stale.
import { countWords, type RequestStoryboardInput } from "@vidcosmos/spec/api";
import type { Project } from "@vidcosmos/spec/collections";
import type { VideoSpec } from "@vidcosmos/spec/video";
import type { Db, Filter, ObjectId } from "mongodb";
import type { JobRef } from "./jobs.ts";
import { ProjectError, textHash } from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";

const projects = (db: Db) => workspaceCollection(db, "projects");

/** The script a storyboard is built from, checked: there is one, and nothing is replaced unasked. */
export function checkStoryboardRequest(
  project: Project,
  input: RequestStoryboardInput,
): NonNullable<Project["script"]> {
  const refusal = (needs: string, message: string) =>
    new ProjectError("STAGE_INVALID", message, {
      stage: project.stage,
      wizardStep: project.wizardStep,
      needs,
    });
  const script = project.script;
  if (!script || countWords(script.text) === 0) {
    throw refusal("script", "There's no script to build scenes from yet. Write one first.");
  }
  if (project.draft.spec && input.overwrite !== true) {
    throw refusal(
      "overwrite",
      "This video has a storyboard. Building a new one replaces its scenes and your edits.",
    );
  }
  return script;
}

/** What the storyboard job reads from the project. */
export async function readStoryboardInputs(
  db: Db,
  workspaceId: ObjectId,
  projectId: ObjectId,
): Promise<Pick<Project, "idea" | "settings" | "script" | "title"> | null> {
  return projects(db).findOne(
    { workspaceId, _id: projectId, deletedAt: null },
    { projection: { idea: 1, settings: 1, script: 1, title: 1 } },
  );
}

export type StoryboardSave = {
  spec: VideoSpec;
  /** The script it was built from: saved only while the project still has it. */
  scriptText: string;
  /** The draft's rev when it was asked for: saved only over that draft. */
  baseRev: number;
  /** Who asked for it. */
  userId: ObjectId;
};

/**
 * Saves the storyboard as the draft while this job still holds the project, and moves the
 * wizard on to the storyboard step. "changed" when the script or the draft changed meanwhile;
 * "gone" when the job no longer holds the project (cancelled, overtaken, or deleted).
 */
export async function saveStoryboard(
  db: Db,
  ref: JobRef & { projectId: ObjectId },
  save: StoryboardSave,
  now = new Date(),
): Promise<{ saved: true; rev: number } | { saved: false; reason: "changed" | "gone" }> {
  const held: Filter<Project> & { workspaceId: ObjectId } = {
    workspaceId: ref.workspaceId,
    _id: ref.projectId,
    deletedAt: null,
    activeJobId: ref.jobId,
  };
  const updated = await projects(db).findOneAndUpdate(
    { ...held, "script.text": save.scriptText, "draft.rev": save.baseRev },
    [
      {
        $set: {
          "draft.spec": { $literal: save.spec },
          "draft.rev": { $add: ["$draft.rev", 1] },
          "draft.updatedAt": now,
          "draft.updatedBy": save.userId,
          "stageHashes.script": textHash(save.scriptText),
          wizardStep: {
            $cond: [
              { $in: ["$wizardStep", ["idea", "angles", "script"]] },
              "storyboard",
              "$wizardStep",
            ],
          },
          updatedAt: now,
        },
      },
    ],
    { returnDocument: "after", projection: { "draft.rev": 1 } },
  );
  if (updated) return { saved: true, rev: updated.draft.rev };
  const stillHeld = (await projects(db).countDocuments(held)) > 0;
  return { saved: false, reason: stillHeld ? "changed" : "gone" };
}
