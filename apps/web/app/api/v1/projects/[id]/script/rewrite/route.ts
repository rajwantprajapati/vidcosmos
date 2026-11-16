// POST /api/v1/projects/{id}/script/rewrite: rewrite all or part of the script: shorter,
// longer, simpler, more engaging, more formal, or as the person says (API §6). `202 Job`
// (`script_rewrite`). The same checks as writing the script. The script as it is now goes into
// the job's input: the rewrite starts from it, and "Undo last rewrite" puts it back.
import {
  checkRewriteRequest,
  createJob,
  leaseHolder,
  parseProjectId,
  reserveGeneration,
  returnGeneration,
  takeLease,
  withIdempotency,
} from "@vidcosmos/db";
import { rewriteScriptInput } from "@vidcosmos/spec/api";
import { apiRoute, editorId, idempotencyKey, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const POST = apiRoute<{ id: string }>(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const projectId = parseProjectId(context.params.id);
  const holder = leaseHolder(context.session.session.id, editorId(context.request));
  const input = await readJson(context.request, rewriteScriptInput);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    {
      workspaceId: owner.workspaceId,
      key,
      route: "POST /projects/:id/script/rewrite",
      body: { projectId: context.params.id, ...input },
    },
    async () => {
      const project = await takeLease(db, owner, projectId, holder);
      const script = checkRewriteRequest(project, input);
      await reserveGeneration(db, owner, projectId, context.workspace.limits.generationsPerVideo);
      try {
        const job = await createJob(db, owner, context.workspace, {
          type: "script_rewrite",
          projectId,
          input: {
            instruction: input.instruction,
            ...(input.custom ? { custom: input.custom } : {}),
            ...(input.selection ? { selection: input.selection } : {}),
            previous: {
              title: script.title,
              hook: script.hook,
              text: script.text,
              source: script.source,
            },
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
