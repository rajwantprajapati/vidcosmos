// What the create steps load on the server: the project as the API shows it, and its jobs.
import "server-only";
import {
  getJob,
  getProject,
  listJobs,
  parseProjectId,
  ProjectError,
  projectStale,
  type ObjectId,
} from "@vidcosmos/db";
import {
  type JobDto,
  listJobsQuery,
  type ProjectDetailDto,
  toJobDto,
  toProjectDetailDto,
} from "@vidcosmos/spec/api";
import type { Job, Project, Workspace } from "@vidcosmos/spec/collections";
import { notFound } from "next/navigation";
import { getDb } from "./db";

/** The project, or the 404 page when it's missing, deleted or another workspace's. */
export async function loadProject(workspace: Workspace, id: string): Promise<Project> {
  try {
    return await getProject(getDb(), workspace._id, parseProjectId(id));
  } catch (error) {
    if (error instanceof ProjectError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

/** The project, or null when it's missing, deleted or another workspace's. */
export async function findProject(workspace: Workspace, id: string): Promise<Project | null> {
  try {
    return await getProject(getDb(), workspace._id, parseProjectId(id));
  } catch (error) {
    if (error instanceof ProjectError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export function projectDto(project: Project, workspace: Workspace): ProjectDetailDto {
  return toProjectDetailDto(project, { workspace, stale: projectStale(project) });
}

/**
 * The job to show on the step: the one running on the project if it's one of `types`, or else
 * the latest of those types if it failed (so a reload still shows the error and "Try again").
 */
export async function stepJob(
  workspaceId: ObjectId,
  project: Project,
  types: Job["type"] | Job["type"][],
): Promise<JobDto | null> {
  const wanted = Array.isArray(types) ? types : [types];
  const db = getDb();
  if (project.activeJobId) {
    const active = await getJob(db, workspaceId, project.activeJobId).catch(() => null);
    if (active && wanted.includes(active.type)) return toJobDto(active);
  }
  const latest = (await recentJobs(workspaceId, project)).find((job) => wanted.includes(job.type));
  return latest?.status === "failed" ? toJobDto(latest) : null;
}

const recentJobs = async (workspaceId: ObjectId, project: Project) =>
  (
    await listJobs(
      getDb(),
      workspaceId,
      listJobsQuery.parse({ projectId: project._id.toHexString(), limit: "10" }),
    )
  ).items;

/**
 * The script before the last rewrite, while "Undo last rewrite" can still put it back: the
 * latest script job was a rewrite that succeeded, and the script hasn't changed since.
 */
export async function undoableRewrite(
  workspaceId: ObjectId,
  project: Project,
): Promise<{ text: string } | null> {
  if (!project.script) return null;
  const latest = (await recentJobs(workspaceId, project)).find(
    (job) => job.type === "script" || job.type === "script_rewrite",
  );
  if (latest?.type !== "script_rewrite" || latest.status !== "succeeded" || !latest.finishedAt) {
    return null;
  }
  if (project.script.updatedAt > latest.finishedAt) return null;
  const previous = (latest.input as { previous?: { text?: unknown } }).previous;
  return typeof previous?.text === "string" ? { text: previous.text } : null;
}
