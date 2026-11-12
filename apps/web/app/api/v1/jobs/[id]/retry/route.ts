// POST /api/v1/jobs/{id}/retry: run a failed job again with the same input (API §11 "Retry").
// `202` with the new job. Needs an Idempotency-Key, like every request that starts work.
import { parseJobId, retryJob, withIdempotency } from "@vidcosmos/db";
import { apiRoute, idempotencyKey } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const jobId = parseJobId(context.params.id);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    {
      workspaceId: owner.workspaceId,
      key,
      route: "POST /jobs/:id/retry",
      body: { jobId: context.params.id },
    },
    async () => {
      const job = await retryJob(db, owner, context.workspace, jobId);
      return { status: 202, resourceId: job._id };
    },
  );
  return startedResponse(owner, result.resourceId, result.replayed);
});
