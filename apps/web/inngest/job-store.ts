// What a job's steps read and write (DB §7). The functions take a `JobStore`, so tests can run
// them with @inngest/test against an in-memory store; the app uses `mongoJobStore`. Steps pass
// the ids from the event (hex strings) and get plain JSON back, which Inngest can memoise.
import {
  advanceJob,
  finishJob,
  type JobOutcome,
  type JobProgress,
  type JobRef,
  ObjectId,
  startJob,
  type Db,
} from "@vidcosmos/db";
import { jobEventData, type JobEventData } from "@vidcosmos/spec/events";
import { z } from "zod";

export type JobKey = Pick<JobEventData, "workspaceId" | "jobId">;

export type JobStore = {
  /** queued → running. False when the job shouldn't run (cancelled or finished). */
  start(job: JobKey, runId: string): Promise<boolean>;
  /** A progress write. False when the job was asked to stop or is no longer running. */
  advance(job: JobKey, update: JobProgress): Promise<boolean>;
  /** Ends the job (once; later calls change nothing) and frees its project. */
  finish(job: JobKey, outcome: JobOutcome): Promise<void>;
};

const refOf = (job: JobKey): JobRef => ({
  workspaceId: new ObjectId(job.workspaceId),
  jobId: new ObjectId(job.jobId),
});

export function mongoJobStore(getDb: () => Db): JobStore {
  return {
    start: (job, runId) => startJob(getDb(), refOf(job), runId),
    advance: (job, update) => advanceJob(getDb(), refOf(job), update),
    finish: async (job, outcome) => {
      await finishJob(getDb(), refOf(job), outcome);
    },
  };
}

/** What the user sees when a job fails for a reason we didn't foresee (API §2 "Job errors"). */
export const internalJobError = {
  code: "INTERNAL",
  message: "Something went wrong. Try again.",
  retryable: true,
} as const;

const failedRun = z.object({ data: z.object({ event: z.object({ data: jobEventData }) }) });

type StepTools = { run: (id: string, fn: () => Promise<void>) => Promise<unknown> };

/**
 * A job function's `onFailure`: Inngest calls it once the run's retries are used up, with the
 * run's triggering event in `data.event`. The job ends `failed` with a retryable error, so the
 * client offers "Try again". Functions with their own error codes (LLM, TTS) replace this.
 */
export function markJobFailed(store: JobStore) {
  return async ({ event, step }: { event: unknown; step: StepTools }) => {
    const parsed = failedRun.safeParse(event);
    if (!parsed.success) return;
    const job = parsed.data.data.event.data;
    await step.run("mark-failed", () =>
      store.finish(job, { status: "failed", error: internalJobError }),
    );
  };
}
