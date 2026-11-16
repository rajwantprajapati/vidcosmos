// POST /api/v1/projects/{id}/script: write the script from the chosen angle, or from the topic
// alone (API §6). `202 Job` (`script`). Needs the edit lease (`X-Editor-Id`) and an
// Idempotency-Key. Uses one of the video's AI requests (`403 LIMIT_REACHED` at the limit),
// given back if the job fails; `409 JOB_IN_PROGRESS` while another job runs on the video.
// Replacing a script the user edited needs `overwrite: true` (`409 STAGE_INVALID`, `needs:
// 'overwrite'`), so they're asked first.
import {
  checkScriptRequest,
  createJob,
  leaseHolder,
  parseProjectId,
  reserveGeneration,
  returnGeneration,
  takeLease,
  withIdempotency,
} from "@vidcosmos/db";
import { requestScriptInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, idempotencyKey, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, requestScriptInput);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    {
      workspaceId: owner.workspaceId,
      key,
      route: "POST /projects/:id/script",
      body: { projectId: context.params.id, ...input },
    },
    async () => {
      // Renews this tab's lease, or refuses with 423 LEASE_HELD when another tab has it.
      const project = await takeLease(db, owner, projectId, holder);
      const { angleId } = checkScriptRequest(project, input);
      await reserveGeneration(db, owner, projectId, context.workspace.limits.generationsPerVideo);
      try {
        const job = await createJob(db, owner, context.workspace, {
          type: "script",
          projectId,
          input: {
            angleId,
            ...(input.instructions ? { instructions: input.instructions } : {}),
            // The new script is saved only over this one, so an edit made meanwhile stays.
            previousText: project.script?.text ?? null,
          },
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
