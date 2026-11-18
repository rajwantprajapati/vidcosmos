// GET, PATCH and DELETE /api/v1/projects/{id} (API §5).
import {
  deleteProject,
  getProject,
  leaseHolder,
  parseProjectId,
  undoneRewriteSource,
  updateProject,
} from "@vidcosmos/db";
import { updateProjectInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, readJson, withETag } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireAllowed } from "@/lib/moderation";
import { ownerOf, projectDetail } from "@/lib/projects";
import { voiceIds } from "@/lib/voices";

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
  await requireAllowed({ ...ownerOf(context), projectId }, [
    input.title ? { kind: "topic", text: input.title } : null,
    input.idea?.topic ? { kind: "topic", text: input.idea.topic } : null,
    input.idea?.notes ? { kind: "notes", text: input.idea.notes } : null,
    input.script?.title ? { kind: "script", text: input.script.title } : null,
    input.script?.hook ? { kind: "script", text: input.script.hook } : null,
    input.script?.text ? { kind: "script", text: input.script.text } : null,
  ]);
  // The editor tabs send their id: then only the tab holding the lease may change the video
  // (423 LEASE_HELD otherwise). Script edits always come from an editor tab.
  const fromEditor = input.script !== undefined || context.request.headers.has("x-editor-id");
  const holder = fromEditor
    ? leaseHolder(context.session.session.id, editorId(context.request))
    : undefined;
  const db = getDb();
  // "Undo last rewrite" puts back the script's earlier source too.
  const scriptSource =
    input.script?.text !== undefined
      ? await undoneRewriteSource(
          db,
          await getProject(db, context.workspace._id, projectId),
          input.script.text,
        )
      : null;
  const project = await updateProject(db, ownerOf(context), projectId, input, new Date(), {
    holder,
    ...(scriptSource ? { scriptSource } : {}),
    voiceIds: voiceIds(),
  });
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
