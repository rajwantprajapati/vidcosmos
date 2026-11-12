// Builds project responses for the signed-in user (API §3 Project).
import "server-only";
import { activeJobs, leaseHolder, type Owner, projectStale, userName } from "@vidcosmos/db";
import {
  type ProjectDetailDto,
  type ProjectSummaryDto,
  toProjectDetailDto,
  toProjectSummaryDto,
} from "@vidcosmos/spec/api";
import type { Project } from "@vidcosmos/spec/collections";
import type { ApiContext } from "./api";
import { getDb } from "./db";

export const ownerOf = (context: ApiContext): Owner => ({
  workspaceId: context.workspace._id,
  userId: context.userId,
});

/** This tab's lease holder id, when the request says which editor tab it comes from. */
export function holderOf(context: ApiContext): string | undefined {
  const tab = context.request.headers.get("x-editor-id")?.trim();
  return tab ? leaseHolder(context.session.session.id, tab) : undefined;
}

export async function projectDetail(
  context: ApiContext,
  project: Project,
): Promise<ProjectDetailDto> {
  const db = getDb();
  const jobs = await activeJobs(db, ownerOf(context), [project]);
  return toProjectDetailDto(project, {
    workspace: context.workspace,
    stale: projectStale(project),
    holder: holderOf(context),
    leaseHolderName: project.lease ? await userName(db, project.lease.userId) : undefined,
    activeJob: project.activeJobId ? jobs.get(project.activeJobId.toHexString()) : null,
  });
}

export async function projectSummaries(
  context: ApiContext,
  list: Project[],
): Promise<ProjectSummaryDto[]> {
  const jobs = await activeJobs(getDb(), ownerOf(context), list);
  return list.map((project) =>
    toProjectSummaryDto(project, {
      activeJob: project.activeJobId ? jobs.get(project.activeJobId.toHexString()) : null,
    }),
  );
}

/** 201 with the new project and its Location (API §1, "Create a resource"). */
export function created(body: ProjectDetailDto, replayed: boolean): Response {
  const headers = new Headers({ Location: `/api/v1/projects/${body.id}` });
  if (replayed) headers.set("Idempotent-Replayed", "true");
  return Response.json(body, { status: 201, headers });
}
