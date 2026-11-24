// POST /api/v1/projects/{id}/generate: record every scene's narration, time the visuals to it
// and save the next version (API §7). `202 Job` (`generate`). Needs the edit lease
// (`X-Editor-Id`) and an Idempotency-Key. Checks, in order: the lease, the draft's rev, a
// storyboard without issues (`409 STAGE_INVALID`), no running job, the concurrent jobs, then
// the monthly video (`403 LIMIT_REACHED`), reserved only if the video hasn't counted yet.
import { leaseHolder, parseProjectId, startGenerate, withIdempotency } from "@vidcosmos/db";
import { generateInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, idempotencyKey, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, generateInput);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    {
      workspaceId: owner.workspaceId,
      key,
      route: "POST /projects/:id/generate",
      body: { projectId: context.params.id, ...input },
    },
    async () => {
      const job = await startGenerate(db, owner, context.workspace, projectId, {
        holder,
        baseRev: input.baseRev,
        idempotencyKey: key,
      });
      return { status: 202, resourceId: job._id };
    },
  );
  return startedResponse(owner, result.resourceId, result.replayed);
});
