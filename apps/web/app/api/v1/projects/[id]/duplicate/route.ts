// POST /api/v1/projects/{id}/duplicate: a new project with the idea, script and draft, no
// history (API §5). The Idempotency-Key is required, as for create, so a double click makes
// one copy.
import { duplicateProject, getProject, parseProjectId, withIdempotency } from "@vidcosmos/db";
import { apiRoute, idempotencyKey } from "@/lib/api";
import { getDb } from "@/lib/db";
import { created, ownerOf, projectDetail } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const db = getDb();
  const key = idempotencyKey(context.request, true)!;
  const result = await withIdempotency(
    db,
    {
      workspaceId: context.workspace._id,
      key,
      route: `POST /projects/${projectId.toHexString()}/duplicate`,
      body: null,
    },
    async () => {
      const copy = await duplicateProject(db, ownerOf(context), projectId);
      return { status: 201, resourceId: copy._id };
    },
  );
  const copy = await getProject(db, context.workspace._id, result.resourceId);
  return created(await projectDetail(context, copy), result.replayed);
});
