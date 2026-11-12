// GET, PATCH and DELETE /api/v1/projects/{id} (API §5).
import { deleteProject, getProject, parseProjectId, updateProject } from "@vidcosmos/db";
import { updateProjectInput } from "@vidcosmos/spec/api";
import { apiRoute, readJson, withETag } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireAllowed } from "@/lib/moderation";
import { ownerOf, projectDetail } from "@/lib/projects";

type Params = { id: string };

/** With an ETag: the editor revalidates cheaply (a matching `If-None-Match` gets a 304). */
export const GET = apiRoute<Params>(async (context) => {
  const project = await getProject(
    getDb(),
    context.workspace._id,
    parseProjectId(context.params.id),
  );
  return withETag(context.request, await projectDetail(context, project));
});

export const PATCH = apiRoute<Params>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const input = await readJson(context.request, updateProjectInput);
  await requireAllowed([
    input.title ? { kind: "topic", text: input.title } : null,
    input.idea?.topic ? { kind: "topic", text: input.idea.topic } : null,
    input.idea?.notes ? { kind: "notes", text: input.idea.notes } : null,
    input.script?.title ? { kind: "script", text: input.script.title } : null,
    input.script?.hook ? { kind: "script", text: input.script.hook } : null,
    input.script?.text ? { kind: "script", text: input.script.text } : null,
  ]);
  const project = await updateProject(getDb(), ownerOf(context), projectId, input);
  return projectDetail(context, project);
});

/** Move to Trash; `X-Cancelled-Posts` says how many scheduled posts were cancelled. */
export const DELETE = apiRoute<Params>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const { cancelledPosts } = await deleteProject(getDb(), ownerOf(context), projectId);
  return new Response(null, {
    status: 204,
    headers: { "X-Cancelled-Posts": String(cancelledPosts) },
  });
});
