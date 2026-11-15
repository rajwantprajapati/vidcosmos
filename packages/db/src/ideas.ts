// AI requests per video and the angles step (API §6, DB §4 "per-project limits").
//
// Each AI step (ideas, script, storyboard, chat) uses one of the project's `generationsPerVideo`.
// The count goes up with a conditional `$inc` against the workspace limit, so two requests at
// once can't pass the limit. `finishJob` settles it: a job that fails or is cancelled gives
// its request back, once (the job's `usage.released` guards it); one that succeeds keeps it.
import type { Project } from "@vidcosmos/spec/collections";
import type { Db, ObjectId } from "mongodb";
import type { JobRef } from "./jobs.ts";
import { workspaceCollection } from "./scoped.ts";

export { releaseJobGeneration, reserveGeneration, returnGeneration } from "./jobs.ts";

const projects = (db: Db) => workspaceCollection(db, "projects");

/** What the ideas step reads from the project. */
export async function readIdeaInputs(
  db: Db,
  workspaceId: ObjectId,
  projectId: ObjectId,
): Promise<Pick<Project, "idea" | "settings" | "createdBy"> | null> {
  return projects(db).findOne(
    { workspaceId, _id: projectId, deletedAt: null },
    { projection: { idea: 1, settings: 1, createdBy: 1 } },
  );
}

/**
 * Replaces the project's angles (API §6: the previous selection is cleared) and moves the
 * wizard from `idea` to `angles`. Only while this job still holds the project, so a job that
 * was cancelled, or overtaken by a newer one, writes nothing. Returns whether it saved.
 */
export async function saveAngles(
  db: Db,
  ref: JobRef & { projectId: ObjectId },
  angles: Project["idea"]["angles"],
  now = new Date(),
): Promise<boolean> {
  const saved = await projects(db).updateOne(
    { workspaceId: ref.workspaceId, _id: ref.projectId, deletedAt: null, activeJobId: ref.jobId },
    [
      {
        $set: {
          "idea.angles": { $literal: angles },
          wizardStep: { $cond: [{ $eq: ["$wizardStep", "idea"] }, "angles", "$wizardStep"] },
          updatedAt: now,
        },
      },
      { $unset: "idea.selectedAngleId" },
    ],
  );
  return saved.matchedCount === 1;
}
