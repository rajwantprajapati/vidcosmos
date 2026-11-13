// GET /api/v1/jobs/{id}: the job's current state, with an ETag for cheap polling (API §11).
import { getJob, parseJobId } from "@vidcosmos/db";
import { toJobDto } from "@vidcosmos/spec/api";
import { apiRoute, withETag } from "@/lib/api";
import { getDb } from "@/lib/db";
import { resendIfWaiting } from "@/lib/jobs";

export const GET = apiRoute<{ id: string }>(async ({ request, workspace, params }) => {
  const job = await getJob(getDb(), workspace._id, parseJobId(params.id));
  // Polling a job whose start never reached Inngest starts it once Inngest is back.
  await resendIfWaiting(job);
  return withETag(request, toJobDto(job));
});
