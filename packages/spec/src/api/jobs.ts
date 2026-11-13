// Jobs API (API §3 Job, §11): the job as the browser sees it, the list query, and the mapper
// from `jobs` documents. Responses never carry Inngest ids, the workspace or the input.
import { z } from "zod";
import { type Job, jobStage, jobStatus, jobType } from "../collections/job.ts";

const id = z.string().regex(/^[0-9a-f]{24}$/);
const iso = z.iso.datetime();

export const jobDto = z.object({
  id,
  type: jobType,
  status: jobStatus,
  stage: jobStage.nullable(),
  /** 0-100, never goes down. */
  progress: z.number().min(0).max(100),
  /** What is happening now, e.g. "Recording narration (4 of 7 scenes)". */
  message: z.string().nullable(),
  projectId: id.nullable(),
  scenes: z
    .array(
      z.object({
        sceneId: z.string(),
        status: z.enum(["pending", "running", "done", "failed", "skipped"]),
      }),
    )
    .nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).nullable(),
  cancellable: z.boolean(),
  createdAt: iso,
  startedAt: iso.nullable(),
  finishedAt: iso.nullable(),
});
export type JobDto = z.infer<typeof jobDto>;

export const jobPageDto = z.object({ items: z.array(jobDto), nextCursor: z.string().nullable() });
export type JobPageDto = z.infer<typeof jobPageDto>;

/** Finished jobs never change again (DB §7). */
export const finishedJobStatuses = ["succeeded", "partial", "failed", "cancelled"] as const;
export const isJobFinished = (status: Job["status"]) =>
  (finishedJobStatuses as readonly string[]).includes(status);

/**
 * Whether `POST /jobs/{id}/cancel` would be accepted: the job hasn't finished, nobody asked
 * already, and it isn't a type that can't stop half-way (API §11). `publish` once the post is
 * uploading joins this with posting (F28).
 */
export const isJobCancellable = (job: Pick<Job, "status" | "type" | "cancelRequestedAt">) =>
  !isJobFinished(job.status) && !job.cancelRequestedAt && job.type !== "account_delete";

export function toJobDto(job: Job): JobDto {
  return {
    id: job._id.toHexString(),
    type: job.type,
    status: job.status,
    stage: job.stage ?? null,
    progress: job.progress,
    message: job.message ?? null,
    projectId: job.projectId?.toHexString() ?? null,
    scenes: job.scenes?.map(({ sceneId, status }) => ({ sceneId, status })) ?? null,
    result: job.result ?? null,
    error: job.error
      ? { code: job.error.code, message: job.error.message, retryable: job.error.retryable }
      : null,
    cancellable: isJobCancellable(job),
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

// ---- Requests ----

/** `GET /jobs?active=true`, `GET /jobs?projectId=…&limit=10` (API §11 "List"). */
export const listJobsQuery = z.object({
  active: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  projectId: id.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
export type ListJobsQuery = z.infer<typeof listJobsQuery>;

/** How the development demo job behaves (F11, /dev/jobs). */
export const demoJobMode = z.enum(["succeed", "fail_once", "fail"]);
export type DemoJobMode = z.infer<typeof demoJobMode>;

export const startDemoJobInput = z.object({
  projectId: id,
  mode: demoJobMode.default("succeed"),
});
export type StartDemoJobInput = z.infer<typeof startDemoJobInput>;
