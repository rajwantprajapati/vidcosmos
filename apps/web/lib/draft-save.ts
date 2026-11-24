// Saving a draft for a request (API §5 "Draft autosave"): what the edit adds is moderated first,
// as a script edit is (changed narration, on-screen text not shown before; a refusal is 422
// CONTENT_BLOCKED and nothing is saved), then `saveDraft` writes it over `baseRev` with the
// lease. Shared by `PUT /draft` and the lease release, which saves a closing tab's last change.
import "server-only";
import { getProject, type ObjectId, saveDraft } from "@vidcosmos/db";
import { type DraftSavedDto, draftSpec, type SaveDraftInput } from "@vidcosmos/spec/api";
import { addedTexts } from "@vidcosmos/spec/video";
import type { ApiContext } from "./api";
import { getDb } from "./db";
import { requireAllowed } from "./moderation";
import { ownerOf } from "./projects";
import { voiceIds } from "./voices";

export async function saveDraftFor(
  context: ApiContext,
  projectId: ObjectId,
  holder: string,
  input: SaveDraftInput,
): Promise<DraftSavedDto> {
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
  return {
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
}
