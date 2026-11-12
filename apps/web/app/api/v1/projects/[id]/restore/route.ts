// POST /api/v1/projects/{id}/restore: bring a project back from Trash within 30 days. Its
// cancelled posts are not rescheduled (API §5).
import { parseProjectId, restoreProject } from "@vidcosmos/db";
import { apiRoute } from "@/lib/api";
import { getDb } from "@/lib/db";
import { ownerOf, projectDetail } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const project = await restoreProject(
    getDb(),
    ownerOf(context),
    parseProjectId(context.params.id),
  );
  return projectDetail(context, project);
});
