// POST /api/v1/jobs/{id}/cancel: ask a job to stop (API §11 "Cancel"). `202` with the job:
// a queued job is cancelled at once; a running one shows `cancellable: false` and becomes
// `cancelled` when its run stops, usually within a few seconds.
import { parseJobId, requestCancel } from "@vidcosmos/db";
import { toJobDto } from "@vidcosmos/spec/api";
import { apiRoute } from "@/lib/api";
import { getDb } from "@/lib/db";
import { accepted, sendCancel } from "@/lib/jobs";

export const POST = apiRoute<{ id: string }>(async ({ workspace, params }) => {
  const { job, signal } = await requestCancel(getDb(), workspace._id, parseJobId(params.id));
  // If this doesn't reach Inngest, the run still stops: its next progress write is refused.
  if (signal) await sendCancel(job);
  return accepted(toJobDto(job));
});
