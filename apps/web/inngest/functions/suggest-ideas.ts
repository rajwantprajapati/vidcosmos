// `suggestIdeas` (SDD §8, API §6): angles for the project's topic. Steps:
//   1. start the job, load the project's idea and settings;
//   2. moderate the topic, notes and steer (API §5: the first AI step moderates, which also
//      catches anything let through while moderation was unavailable);
//   3. ask the LLM for the angles, recording each call's usage;
//   4. save them on the project (replacing the old ones, clearing the pick);
//   5. finish with `{ type: 'ideas', angleIds }`.
// A refusal or an LLM failure ends the job `failed` with its code and message. Finishing a job
// that didn't succeed gives its AI request back (`finishJob`). Retries 2 (SDD §8).
import { randomUUID } from "node:crypto";
import {
  type LlmAttempt,
  type LlmProvider,
  moderate,
  type ModerationInput,
  suggestAngles,
} from "@vidcosmos/pipeline";
import type { Inngest } from "inngest";
import { type JobErrorInfo, isLlmError, llmJobError } from "../errors";
import { ideasRequested, jobCancelRequested } from "../events";
import type { IdeasJob, IdeasStore } from "../ideas-store";
import { type JobStore, markJobFailed } from "../job-store";

export type SuggestIdeasDeps = {
  jobs: JobStore;
  ideas: IdeasStore;
  /** The generation model and the small one (moderation). */
  llm: () => LlmProvider;
  small: () => LlmProvider;
  /** An `onAttempt` that records usage events for this job. */
  usage: (
    job: IdeasJob,
    userId: string,
    operation: "ideas" | "moderation",
  ) => (attempt: LlmAttempt) => Promise<void>;
  newAngleId?: () => string;
};

type Halt = { halt: "stopped" } | { halt: "failed"; error: JobErrorInfo };

const angleId = () => `ang_${randomUUID().replaceAll("-", "").slice(0, 10)}`;

export function createSuggestIdeas(inngest: Inngest, deps: SuggestIdeasDeps) {
  const { jobs, ideas } = deps;
  return inngest.createFunction(
    {
      id: "suggest-ideas",
      name: "Suggest angles",
      triggers: [ideasRequested],
      retries: 2,
      cancelOn: [{ event: jobCancelRequested, match: "data.jobId" }],
      onFailure: markJobFailed(jobs),
    },
    async ({ event, step, runId }) => {
      const job = event.data;

      const halt = async (reason: Halt) => {
        if (reason.halt === "failed") {
          await step.run("fail", () => jobs.finish(job, { status: "failed", error: reason.error }));
          return { outcome: "failed" as const, code: reason.error.code };
        }
        await step.run("stop", () => jobs.finish(job, { status: "cancelled" }));
        return { outcome: "cancelled" as const };
      };

      if (!(await step.run("start", () => jobs.start(job, runId)))) {
        return { outcome: "skipped" as const };
      }
      const inputs = await step.run("load", () => ideas.load(job));
      if (!inputs) return halt({ halt: "stopped" });

      const checked = await step.run("moderate", async (): Promise<Halt | { ok: true }> => {
        const going = await jobs.advance(job, {
          stage: "moderation",
          progress: 10,
          message: "Checking the topic",
        });
        if (!going) return { halt: "stopped" };
        const texts: ModerationInput[] = [
          { kind: "topic", text: inputs.topic },
          ...(inputs.notes ? [{ kind: "notes" as const, text: inputs.notes }] : []),
          ...(job.steer ? [{ kind: "topic" as const, text: job.steer }] : []),
        ];
        try {
          const result = await moderate(deps.small(), texts, {
            onAttempt: deps.usage(job, inputs.userId, "moderation"),
          });
          if (result.decision === "allow") return { ok: true };
          await ideas.recordModeration(job, inputs.userId, result);
          return {
            halt: "failed",
            error: { code: "CONTENT_BLOCKED", message: result.reason, retryable: false },
          };
        } catch (error) {
          if (isLlmError(error)) return { halt: "failed", error: llmJobError(error, "angles") };
          throw error;
        }
      });
      if ("halt" in checked) return halt(checked);

      const suggested = await step.run("suggest", async () => {
        const going = await jobs.advance(job, {
          stage: "llm",
          progress: 30,
          message: "Suggesting angles",
        });
        if (!going) return { halt: "stopped" } satisfies Halt;
        try {
          const { userId: _who, ...request } = inputs;
          const angles = await suggestAngles(
            deps.llm(),
            { ...request, count: job.count, ...(job.steer ? { steer: job.steer } : {}) },
            { onAttempt: deps.usage(job, inputs.userId, "ideas") },
          );
          return { angles };
        } catch (error) {
          if (isLlmError(error)) {
            return { halt: "failed", error: llmJobError(error, "angles") } satisfies Halt;
          }
          throw error;
        }
      });
      if ("halt" in suggested) return halt(suggested as Halt);

      const saved = await step.run("save", async () => {
        const going = await jobs.advance(job, {
          stage: "save",
          progress: 90,
          message: "Saving the angles",
        });
        if (!going) return null;
        const angles = suggested.angles.map((angle) => ({
          id: (deps.newAngleId ?? angleId)(),
          ...angle,
        }));
        return (await ideas.saveAngles(job, angles)) ? angles.map((a) => a.id) : null;
      });
      if (!saved) return halt({ halt: "stopped" });

      await step.run("finish", () =>
        jobs.finish(job, { status: "succeeded", result: { type: "ideas", angleIds: saved } }),
      );
      return { outcome: "succeeded" as const, angleIds: saved };
    },
  );
}
