// PUT /api/v1/projects/{id}/draft: autosave the whole draft spec (API §5, DB §11).
import { leaseHolder, parseProjectId, saveDraft } from "@vidcosmos/db";
import { type DraftSavedDto, saveDraftInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { ownerOf } from "@/lib/projects";

export const PUT = apiRoute<{ id: string }>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, saveDraftInput);
  const saved = await saveDraft(getDb(), ownerOf(context), projectId, holder, input);
  const body: DraftSavedDto = {
    rev: saved.rev,
    updatedAt: saved.updatedAt.toISOString(),
    staleSceneIds: saved.staleSceneIds,
    // The semantic checks (DB §6) arrive with the full VideoSpec schema (F16).
    issues: [],
  };
  return body;
});
