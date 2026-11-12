// GET /api/v1/projects: the library list. POST: start a new video from a topic (API §5).
import { createProject, getProject, listProjects, withIdempotency } from "@vidcosmos/db";
import { createProjectInput, listProjectsQuery } from "@vidcosmos/spec/api";
import { apiRoute, idempotencyKey, readJson, readQuery } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireAllowed } from "@/lib/moderation";
import { created, ownerOf, projectDetail, projectSummaries } from "@/lib/projects";

export const GET = apiRoute(async (context) => {
  const query = readQuery(context.request, listProjectsQuery);
  const page = await listProjects(getDb(), context.workspace._id, query);
  return { items: await projectSummaries(context, page.items), nextCursor: page.nextCursor };
});

export const POST = apiRoute(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const input = await readJson(context.request, createProjectInput);
  const db = getDb();
  const result = await withIdempotency(
    db,
    { workspaceId: context.workspace._id, key, route: "POST /projects", body: input },
    async () => {
      // Checked before anything is saved; a refusal saves nothing (API §5).
      await requireAllowed([
        { kind: "topic", text: input.topic },
        input.notes ? { kind: "notes", text: input.notes } : null,
      ]);
      const project = await createProject(db, ownerOf(context), context.workspace, input);
      return { status: 201, resourceId: project._id };
    },
  );
  const project = await getProject(db, context.workspace._id, result.resourceId);
  return created(await projectDetail(context, project), result.replayed);
});
