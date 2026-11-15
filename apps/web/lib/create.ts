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
 * The job of this type to show on the step: the one running on the project, or else the
 * latest one if it failed (so a reload still shows the error and "Try again").
 */
export async function stepJob(
  workspaceId: ObjectId,
  project: Project,
  type: Job["type"],
): Promise<JobDto | null> {
  const db = getDb();
  if (project.activeJobId) {
    const active = await getJob(db, workspaceId, project.activeJobId).catch(() => null);
    if (active?.type === type) return toJobDto(active);
  }
  const recent = await listJobs(
    db,
    workspaceId,
    listJobsQuery.parse({ projectId: project._id.toHexString(), limit: "10" }),
  );
  const latest = recent.items.find((job) => job.type === type);
  return latest?.status === "failed" ? toJobDto(latest) : null;
}
