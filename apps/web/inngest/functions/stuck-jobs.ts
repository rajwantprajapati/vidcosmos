// `failStuckJobs` (SDD §8 "Timeouts", §15): every 10 minutes, any job with no progress for 15
// minutes, or queued that long, ends `failed` with a retryable error. Finishing it frees its
// project and gives back what it held: a reserved video, or an AI request.
import type { Inngest } from "inngest";
import type { JobKey, JobStore } from "../job-store";

export type StuckJobDeps = {
  jobs: JobStore;
  /** Jobs that stopped responding, as of now. */
  findStuck: () => Promise<JobKey[]>;
};

export const stuckJobError = {
  code: "JOB_STUCK",
  message: "This stopped responding. Try again.",
  retryable: true,
} as const;

export function createFailStuckJobs(inngest: Inngest, deps: StuckJobDeps) {
  return inngest.createFunction(
    {
      id: "fail-stuck-jobs",
      name: "Fail stuck jobs",
      triggers: [{ cron: "*/10 * * * *" }],
      retries: 2,
    },
    async ({ step }) => {
      const stuck = await step.run("find", () => deps.findStuck());
      for (const job of stuck) {
        await step.run(`fail-${job.jobId}`, () =>
          deps.jobs.finish(job, { status: "failed", error: stuckJobError }),
        );
      }
      return { failed: stuck.length };
    },
  );
}
