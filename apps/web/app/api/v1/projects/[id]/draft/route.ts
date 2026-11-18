// PUT /api/v1/projects/{id}/draft: autosave the whole draft spec (API §5, DB §11). What the
// edit adds is moderated first, as a script edit is: changed narration (it becomes the
// script) and on-screen text not shown before; a refusal is 422 CONTENT_BLOCKED and nothing
// is saved. Only what changed is checked, so a save that changes no words costs nothing.
import { getProject, leaseHolder, parseProjectId, saveDraft } from "@vidcosmos/db";
import { type DraftSavedDto, draftSpec, saveDraftInput } from "@vidcosmos/spec/api";
import { addedTexts } from "@vidcosmos/spec/video";
import { apiRoute, editorId, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireAllowed } from "@/lib/moderation";
import { ownerOf } from "@/lib/projects";
import { voiceIds } from "@/lib/voices";

export const PUT = apiRoute<{ id: string }>(async (context) => {
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, saveDraftInput);
  const db = getDb();
  const owner = ownerOf(context);
  const current = await getProject(db, owner.workspaceId, projectId);
  const added = addedTexts(draftSpec(current), input.spec);
  await requireAllowed({ ...owner, projectId }, [
    ...added.narration.map((text) => ({ kind: "script" as const, text })),
    ...added.onScreen.map((text) => ({ kind: "scene_text" as const, text })),
  ]);
  const saved = await saveDraft(db, owner, projectId, holder, input, new Date(), {
    voiceIds: voiceIds(),
  });
  const body: DraftSavedDto = {
    rev: saved.rev,
    updatedAt: saved.updatedAt.toISOString(),
    staleSceneIds: saved.staleSceneIds,
    issues: saved.issues.map(({ sceneId, code, path, message }) => ({
      sceneId,
      code,
      ...(path ? { path } : {}),
      message,
    })),
  };
  return body;
});
