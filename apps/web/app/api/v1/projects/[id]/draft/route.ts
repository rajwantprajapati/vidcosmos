// PUT /api/v1/projects/{id}/draft: autosave the whole draft spec (API §5, DB §11). What the
// edit adds is moderated first (`saveDraftFor`); only what changed is checked, so a save that
// changes no words costs nothing.
import { leaseHolder, parseProjectId } from "@vidcosmos/db";
import { saveDraftInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, readJson } from "@/lib/api";
import { saveDraftFor } from "@/lib/draft-save";

export const PUT = apiRoute<{ id: string }>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, saveDraftInput);
  return saveDraftFor(context, projectId, holder, input);
});
