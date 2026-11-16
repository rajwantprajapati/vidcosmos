// The script step (API §6, DB §5): what the script and rewrite requests may do, and saving
// the result on the project.
//
// A new script over one the user edited needs `overwrite` (`409 STAGE_INVALID`, `needs:
// 'overwrite'`). Both jobs keep the script as it was when asked for in their input, and save
// only if it hasn't changed since, so an edit made meanwhile is never lost. Writing the script records what it was written from (`stageHashes.idea`), so a
// later change to the topic, notes or angle marks it stale.
import { countWords, type RequestScriptInput, type RewriteScriptInput } from "@vidcosmos/spec/api";
import type { Project } from "@vidcosmos/spec/collections";
import type { Db, Filter, ObjectId } from "mongodb";
import type { JobRef } from "./jobs.ts";
import { ProjectError } from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";

const projects = (db: Db) => workspaceCollection(db, "projects");

/** The user changed this script by hand (or wrote it). */
export const scriptEdited = (script: Project["script"]) =>
  Boolean(script && script.source !== "ai");

const refusal = (project: Project, needs: string, message: string) =>
  new ProjectError("STAGE_INVALID", message, {
    stage: project.stage,
    wizardStep: project.wizardStep,
    needs,
  });

/** The angle a script request writes from (its own, or the one picked), checked. */
export function checkScriptRequest(
  project: Project,
  input: RequestScriptInput,
): { angleId: string | null } {
  const angleId = input.angleId ?? project.idea.selectedAngleId ?? null;
  if (angleId && !project.idea.angles.some((angle) => angle.id === angleId)) {
    throw refusal(project, "angles", "That angle isn't one of this video's angles.");
  }
  if (scriptEdited(project.script) && input.overwrite !== true) {
    throw refusal(
      project,
      "overwrite",
      "You've edited this script. Writing a new one replaces your changes.",
    );
  }
  return { angleId };
}

/** The script a rewrite starts from, checked: there is one, and the selection is inside it. */
export function checkRewriteRequest(
  project: Project,
  input: RewriteScriptInput,
): NonNullable<Project["script"]> {
  const script = project.script;
  if (!script || countWords(script.text) === 0) {
    throw refusal(project, "script", "There's no script to rewrite yet. Write some first.");
  }
  if (input.selection && input.selection.end > script.text.length) {
    throw refusal(project, "selection", "The script changed. Select the part again.");
  }
  if (input.selection && !script.text.slice(input.selection.start, input.selection.end).trim()) {
    throw refusal(project, "selection", "Select some words to rewrite.");
  }
  return script;
}

/** What the script jobs read from the project. */
export async function readScriptInputs(
  db: Db,
  workspaceId: ObjectId,
  projectId: ObjectId,
): Promise<Pick<Project, "idea" | "settings" | "script" | "title"> | null> {
  return projects(db).findOne(
    { workspaceId, _id: projectId, deletedAt: null },
    { projection: { idea: 1, settings: 1, script: 1, title: 1 } },
  );
}

export type ScriptSave = {
  script: NonNullable<Project["script"]>;
  /** Writing: what the script was written from (`stageHashes.idea`). */
  ideaHash?: string;
  /** Writing: the project's title becomes the script's if it is still this (the topic). */
  autoTitle?: string;
  /** Writing: the angle it was written from becomes the picked one. */
  angleId?: string;
  /** Saved only if the script still has this text (null: still has no script). */
  expectText?: string | null;
};

/**
 * Saves the script while this job still holds the project, and moves the wizard on to the
 * script step. "changed" when a rewrite's script was edited meanwhile; "gone" when the job no
 * longer holds the project (cancelled, overtaken, or the project deleted).
 */
export async function saveScript(
  db: Db,
  ref: JobRef & { projectId: ObjectId },
  save: ScriptSave,
  now = new Date(),
): Promise<"saved" | "changed" | "gone"> {
  const held: Filter<Project> & { workspaceId: ObjectId } = {
    workspaceId: ref.workspaceId,
    _id: ref.projectId,
    deletedAt: null,
    activeJobId: ref.jobId,
  };
  const filter: Filter<Project> & { workspaceId: ObjectId } =
    save.expectText === undefined
      ? held
      : save.expectText === null
        ? { ...held, script: null }
        : { ...held, "script.text": save.expectText };
  const result = await projects(db).updateOne(filter, [
    {
      $set: {
        script: { $literal: save.script },
        ...(save.ideaHash ? { "stageHashes.idea": save.ideaHash } : {}),
        ...(save.angleId ? { "idea.selectedAngleId": save.angleId } : {}),
        ...(save.autoTitle !== undefined
          ? {
              title: {
                $cond: [{ $eq: ["$title", save.autoTitle] }, save.script.title, "$title"],
              },
            }
          : {}),
        wizardStep: {
          $cond: [{ $in: ["$wizardStep", ["idea", "angles"]] }, "script", "$wizardStep"],
        },
        updatedAt: now,
      },
    },
  ]);
  if (result.matchedCount === 1) return "saved";
  if (save.expectText === undefined) return "gone";
  return (await projects(db).countDocuments(held)) > 0 ? "changed" : "gone";
}

/**
 * The source a script edit should keep: "Undo last rewrite" puts back the text the latest
 * rewrite started from, and that text's source with it (an AI script stays `ai`). Only while
 * the script is still the rewrite's result; any other edit is the user's own (`ai_edited`).
 */
export async function undoneRewriteSource(
  db: Db,
  project: Project,
  text: string,
): Promise<NonNullable<Project["script"]>["source"] | null> {
  if (!project.script) return null;
  const latest = await workspaceCollection(db, "jobs").findOne(
    {
      workspaceId: project.workspaceId,
      projectId: project._id,
      type: { $in: ["script", "script_rewrite"] },
    },
    { sort: { createdAt: -1, _id: -1 } },
  );
  if (latest?.type !== "script_rewrite" || latest.status !== "succeeded" || !latest.finishedAt) {
    return null;
  }
  if (project.script.updatedAt > latest.finishedAt) return null;
  const previous = (latest.input as { previous?: { text?: unknown; source?: unknown } }).previous;
  if (previous?.text !== text) return null;
  const source = previous.source;
  return source === "ai" || source === "user" || source === "ai_edited" ? source : null;
}
