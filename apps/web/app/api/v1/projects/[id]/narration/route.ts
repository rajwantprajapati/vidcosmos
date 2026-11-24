// POST /api/v1/projects/{id}/narration: record some scenes' narration again and save the next
// version (API §7 "Narration for some scenes"). `202 Job` (`scene_retry`). Needs the edit lease
// (`X-Editor-Id`) and an Idempotency-Key. The scenes default to every scene without a current
// recording; retrying failed scenes uses no video and no revision.
import { leaseHolder, parseProjectId, startNarration, withIdempotency } from "@vidcosmos/db";
import { updateNarrationInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, idempotencyKey, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, updateNarrationInput);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    {
      workspaceId: owner.workspaceId,
      key,
      route: "POST /projects/:id/narration",
      body: { projectId: context.params.id, ...input },
    },
    async () => {
      const job = await startNarration(db, owner, context.workspace, projectId, {
        holder,
        baseRev: input.baseRev,
        ...(input.sceneIds ? { sceneIds: input.sceneIds } : {}),
        idempotencyKey: key,
      });
      return { status: 202, resourceId: job._id };
    },
  );
  return startedResponse(owner, result.resourceId, result.replayed);
});
