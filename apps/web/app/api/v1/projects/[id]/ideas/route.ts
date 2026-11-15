// POST /api/v1/projects/{id}/ideas: suggest angles for the topic (API §6). `202 Job` (`ideas`).
// Needs the edit lease (`X-Editor-Id`) and an Idempotency-Key. Uses one of the video's AI
// requests (`403 LIMIT_REACHED` at the limit), given back if the job fails; `409
// JOB_IN_PROGRESS` while another job runs on the video. The angles replace the old ones.
import {
  createJob,
  leaseHolder,
  parseProjectId,
  reserveGeneration,
  returnGeneration,
  takeLease,
  withIdempotency,
} from "@vidcosmos/db";
import { requestIdeasInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, idempotencyKey, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, requestIdeasInput);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    {
      workspaceId: owner.workspaceId,
      key,
      route: "POST /projects/:id/ideas",
      body: { projectId: context.params.id, ...input },
    },
    async () => {
      // Renews this tab's lease, or refuses with 423 LEASE_HELD when another tab has it.
      await takeLease(db, owner, projectId, holder);
      await reserveGeneration(db, owner, projectId, context.workspace.limits.generationsPerVideo);
      try {
        const job = await createJob(db, owner, context.workspace, {
          type: "ideas",
          projectId,
          input: { count: input.count, ...(input.steer ? { steer: input.steer } : {}) },
          idempotencyKey: key,
          reservesGeneration: true,
        });
        return { status: 202, resourceId: job._id };
      } catch (error) {
        await returnGeneration(db, owner, projectId);
        throw error;
      }
    },
  );
  return startedResponse(owner, result.resourceId, result.replayed);
});
