// Development only (F11): start the demo job on one of your videos. 404 in production.
// The same checks as a real job: one running job per video, and the concurrent-jobs limit.
import { createJob, ObjectId, withIdempotency } from "@vidcosmos/db";
import { startDemoJobInput } from "@vidcosmos/spec/api";
import { apiRoute, idempotencyKey, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { startedResponse } from "@/lib/jobs";
import { ownerOf } from "@/lib/projects";

export const dynamic = "force-dynamic";

const start = apiRoute(async (context) => {
  const key = idempotencyKey(context.request, true)!;
  const input = await readJson(context.request, startDemoJobInput);
  const db = getDb();
  const owner = ownerOf(context);
  const result = await withIdempotency(
    db,
    { workspaceId: owner.workspaceId, key, route: "POST /dev/jobs/demo", body: input },
    async () => {
      const job = await createJob(db, owner, context.workspace, {
        type: "demo",
        projectId: new ObjectId(input.projectId),
        input: { mode: input.mode },
        idempotencyKey: key,
      });
      return { status: 202, resourceId: job._id };
    },
  );
  return startedResponse(owner, result.resourceId, result.replayed);
});

// Checked outside `apiRoute`, which would turn Next's notFound() into a 500.
export function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  return start(request);
}
