// GET /api/v1/jobs: recent and running jobs, newest first (API §11 "List").
// `?active=true` is what the app uses to resume progress after a reload.
import { listJobs } from "@vidcosmos/db";
import { listJobsQuery, toJobDto } from "@vidcosmos/spec/api";
import { apiRoute, readQuery } from "@/lib/api";
import { getDb } from "@/lib/db";
import { resendIfWaiting } from "@/lib/jobs";

export const GET = apiRoute(async ({ request, workspace }) => {
  const page = await listJobs(getDb(), workspace._id, readQuery(request, listJobsQuery));
  await Promise.all(page.items.map((job) => resendIfWaiting(job)));
  return { items: page.items.map(toJobDto), nextCursor: page.nextCursor };
});
