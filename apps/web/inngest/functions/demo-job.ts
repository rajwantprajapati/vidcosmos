// The demo job (F11, development only): fake steps that move a job through the stages a real
// generation shows, so the job machinery (progress, reload, cancel, retry) can be seen and
// tested before the real pipeline exists. Started from /dev/jobs.
//
// Each stage waits (`step.sleep`), then writes its progress. A progress write that is refused
// means someone asked the job to stop: the job ends `cancelled`. `cancelOn` also stops the run
// between steps when `job/cancel.requested` arrives for this job.
import type { DemoJobMode } from "@vidcosmos/spec/api";
import type { Inngest } from "inngest";
import { demoJobRequested, jobCancelRequested } from "../events";
import { type JobStore, markJobFailed } from "../job-store";

export const demoStages = [
  { id: "check-topic", stage: "moderation", progress: 10, message: "Checking the topic" },
  { id: "write-script", stage: "llm", progress: 25, message: "Writing the script" },
  {
    id: "narrate-1",
    stage: "narration",
    progress: 40,
    message: "Recording narration (1 of 3 scenes)",
  },
  {
    id: "narrate-2",
    stage: "narration",
    progress: 55,
    message: "Recording narration (2 of 3 scenes)",
  },
  {
    id: "narrate-3",
    stage: "narration",
    progress: 70,
    message: "Recording narration (3 of 3 scenes)",
  },
  { id: "timing", stage: "timing", progress: 85, message: "Timing every scene to the voice" },
  { id: "save", stage: "save", progress: 95, message: "Saving the video" },
] as const;

/** The stage where the failing modes fail. */
const failingStage = "timing";

export class DemoFailure extends Error {
  constructor() {
    super("The demo job failed on purpose.");
    this.name = "DemoFailure";
  }
}

const fails = (mode: DemoJobMode, stageId: string, attempt: number) =>
  stageId === failingStage && (mode === "fail" || (mode === "fail_once" && attempt === 0));

export type DemoJobOptions = {
  /** How long each fake stage takes, e.g. "1s". */
  pause: string;
};

export function createDemoJob(inngest: Inngest, store: JobStore, options: DemoJobOptions) {
  return inngest.createFunction(
    {
      id: "demo-job",
      name: "Demo job (development)",
      triggers: [demoJobRequested],
      // One retry, so the failing modes finish quickly.
      retries: 1,
      cancelOn: [{ event: jobCancelRequested, match: "data.jobId" }],
      onFailure: markJobFailed(store),
    },
    async ({ event, step, runId, attempt }) => {
      const job = event.data;
      const started = await step.run("start", () => store.start(job, runId));
      if (!started) return { outcome: "skipped" as const };

      for (const stage of demoStages) {
        await step.sleep(`wait-${stage.id}`, options.pause);
        const going = await step.run(stage.id, async () => {
          if (fails(job.mode, stage.id, attempt)) throw new DemoFailure();
          return store.advance(job, {
            stage: stage.stage,
            progress: stage.progress,
            message: stage.message,
          });
        });
        if (!going) {
          await step.run("stop", () => store.finish(job, { status: "cancelled" }));
          return { outcome: "cancelled" as const };
        }
      }

      await step.run("finish", () =>
        store.finish(job, { status: "succeeded", result: { type: "demo" } }),
      );
      return { outcome: "succeeded" as const };
    },
  );
}
