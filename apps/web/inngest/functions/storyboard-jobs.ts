// `buildStoryboard` (SDD §8, API §6):
//   1. start the job, load the script, settings and the job's input (script, draft rev);
//   2. moderate the script (SDD §15: before the storyboard);
//   3. ask the LLM for the scenes: checked against the VideoSpec and its rules, problems fed
//      back up to 3 attempts (`buildStoryboard` in the pipeline), recording each call's usage;
//   4. moderate the scenes' on-screen text;
//   5. save it as the draft with the script it was made from, and finish with the new rev.
//      It's saved only over the script and draft there were when it was asked for: an edit
//      made meanwhile stays, and the job ends cancelled, giving its request back.
//
// A refusal or an LLM failure ends the job `failed` with its code and message. Retries 2.
import {
  buildStoryboard,
  type LlmAttempt,
  type LlmProvider,
  moderate,
  type ModerationInput,
} from "@vidcosmos/pipeline";
import { sceneTexts, type VideoSpec } from "@vidcosmos/spec/video";
import type { Inngest } from "inngest";
import { type JobErrorInfo, isLlmError, llmJobError } from "../errors";
import { jobCancelRequested, storyboardRequested } from "../events";
import { type JobStore, markJobFailed } from "../job-store";
import type { StoryboardJob, StoryboardStore } from "../storyboard-store";

export type StoryboardJobDeps = {
  jobs: JobStore;
  storyboards: StoryboardStore;
  /** The generation model and the small one (moderation). */
  llm: () => LlmProvider;
  small: () => LlmProvider;
  /** An `onAttempt` that records usage events for this job. */
  usage: (
    job: StoryboardJob,
    userId: string,
    operation: "storyboard" | "moderation",
  ) => (attempt: LlmAttempt) => Promise<void>;
};

type Halt = { halt: "stopped" } | { halt: "failed"; error: JobErrorInfo };

const what = "build the storyboard";

/** Every text the scenes put on screen, one line each: what the viewer reads. */
export function onScreenText(spec: VideoSpec): string {
  return [...new Set([spec.title, ...spec.scenes.flatMap(sceneTexts)])].join("\n");
}

export function createBuildStoryboard(inngest: Inngest, deps: StoryboardJobDeps) {
  const { jobs, storyboards } = deps;

  /** Moderates `texts`; a block is recorded and becomes the job's CONTENT_BLOCKED failure. */
  async function moderateTexts(
    job: StoryboardJob,
    userId: string,
    texts: ModerationInput[],
  ): Promise<Halt | { ok: true }> {
    try {
      const result = await moderate(deps.small(), texts, {
        onAttempt: deps.usage(job, userId, "moderation"),
      });
      if (result.decision === "allow") return { ok: true };
      await storyboards.recordModeration(job, userId, result);
      return {
        halt: "failed",
        error: { code: "CONTENT_BLOCKED", message: result.reason, retryable: false },
      };
    } catch (error) {
      if (isLlmError(error)) return { halt: "failed", error: llmJobError(error, what) };
      throw error;
    }
  }

  return inngest.createFunction(
    {
      id: "build-storyboard",
      name: "Build the storyboard",
      triggers: [storyboardRequested],
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
      const inputs = await step.run("load", () => storyboards.load(job));
      if (!inputs) return halt({ halt: "stopped" });
      const { request, userId } = inputs;

      const checked = await step.run("moderate", async (): Promise<Halt | { ok: true }> => {
        const going = await jobs.advance(job, {
          stage: "moderation",
          progress: 10,
          message: "Checking the script",
        });
        if (!going) return { halt: "stopped" };
        return moderateTexts(job, userId, [{ kind: "script", text: request.script }]);
      });
      if ("halt" in checked) return halt(checked);

      const built = await step.run("build", async () => {
        const going = await jobs.advance(job, {
          stage: "llm",
          progress: 30,
          message: "Planning the scenes",
        });
        if (!going) return { halt: "stopped" } satisfies Halt;
        try {
          return {
            spec: await buildStoryboard(deps.llm(), request, {
              onAttempt: deps.usage(job, userId, "storyboard"),
            }),
          };
        } catch (error) {
          if (isLlmError(error)) {
            return { halt: "failed", error: llmJobError(error, what) } satisfies Halt;
          }
          throw error;
        }
      });
      if ("halt" in built) return halt(built as Halt);
      // Step results come back as JSON: the spec is plain JSON already.
      const spec = built.spec as VideoSpec;

      const reviewed = await step.run("check", async (): Promise<Halt | { ok: true }> => {
        const going = await jobs.advance(job, {
          stage: "moderation",
          progress: 80,
          message: "Checking the scenes",
        });
        if (!going) return { halt: "stopped" };
        return moderateTexts(job, userId, [{ kind: "scene_text", text: onScreenText(spec) }]);
      });
      if ("halt" in reviewed) return halt(reviewed);

      const saved = await step.run("save", async () => {
        const going = await jobs.advance(job, {
          stage: "save",
          progress: 90,
          message: "Saving the storyboard",
        });
        if (!going) return { saved: false } as const;
        return storyboards.save(job, spec, inputs);
      });
      if (!saved.saved) return halt({ halt: "stopped" });

      await step.run("finish", () =>
        jobs.finish(job, {
          status: "succeeded",
          result: { type: "storyboard", draftRev: saved.rev },
        }),
      );
      return { outcome: "succeeded" as const };
    },
  );
}
