// POST /api/v1/projects/{id}/storyboard: split the script into scenes and pick a template and
// visuals for each (API §6). `202 Job` (`storyboard`). Needs the edit lease (`X-Editor-Id`)
// and an Idempotency-Key. Uses one of the video's AI requests (`403 LIMIT_REACHED` at the
// limit), given back if the job fails; `409 JOB_IN_PROGRESS` while another job runs on the
// video. Replacing a storyboard needs `overwrite: true` (`409 STAGE_INVALID`, `needs:
// 'overwrite'`), so the person is asked first.
import {
  checkStoryboardRequest,
  createJob,
  leaseHolder,
  parseProjectId,
  reserveGeneration,
  returnGeneration,
  takeLease,
  withIdempotency,
} from "@vidcosmos/db";
import { requestStoryboardInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, idempotencyKey, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, requestStoryboardInput);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    {
      workspaceId: owner.workspaceId,
      key,
      route: "POST /projects/:id/storyboard",
      body: { projectId: context.params.id, ...input },
    },
    async () => {
      // Renews this tab's lease, or refuses with 423 LEASE_HELD when another tab has it.
      const project = await takeLease(db, owner, projectId, holder);
      const script = checkStoryboardRequest(project, input);
      await reserveGeneration(db, owner, projectId, context.workspace.limits.generationsPerVideo);
      try {
        const job = await createJob(db, owner, context.workspace, {
          type: "storyboard",
          projectId,
          // Saved only over this script and this draft, so an edit made meanwhile stays.
          input: { scriptText: script.text, baseRev: project.draft.rev },
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
