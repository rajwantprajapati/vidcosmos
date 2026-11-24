// `generateVideo` and `retryScene` (SDD §8, API §7): one body, two triggers.
//   1. start the job and snapshot the draft;
//   2. moderate the narration and the on-screen text (SDD §15: before generation);
//   3. narration: up to 4 scenes at a time, one step per batch. A scene whose narration and
//      voice are in the cache is `skipped` and costs nothing; otherwise the voice service is
//      tried up to 3 times (not again for errors that won't change, such as a refused key).
//      A scene that still fails is recorded and the others carry on;
//   4. timing: each recording becomes its scene's timing (pure code);
//   5. save: a new version and the draft, in one transaction (with the video's commit on a
//      first generation);
//   6. finish: `succeeded`, `partial` when some scenes failed (they play silently until
//      retried), or `failed` when nothing was recorded, which gives the video back.
//
// Generate records every scene (the cache makes unchanged ones free); a retry records the
// scenes in its input, or those without a current recording.
import { isTtsError } from "@vidcosmos/integrations";
import {
  type LlmAttempt,
  type LlmProvider,
  moderate,
  type ModerationInput,
  narrationTasks,
  type NarrationTask,
  type Recording,
  withTimings,
} from "@vidcosmos/pipeline";
import type { VideoSpec } from "@vidcosmos/spec/video";
import type { Inngest } from "inngest";
import { type JobErrorInfo, isLlmError, llmJobError } from "../errors";
import { generateRequested, jobCancelRequested, sceneRetryRequested } from "../events";
import { type JobStore, markJobFailed } from "../job-store";
import type { NarrationJob, NarrationStore, SceneError } from "../narration-store";
import { onScreenText } from "./storyboard-jobs";

export type NarrationJobDeps = {
  jobs: JobStore;
  narration: NarrationStore;
  /** The small model, for moderation. */
  small: () => LlmProvider;
  usage: (
    job: NarrationJob,
    userId: string,
    operation: "moderation",
  ) => (attempt: LlmAttempt) => Promise<void>;
  /** The wait before the second try, doubled for the third (0 in tests). */
  retryDelayMs?: number;
};

/** Scenes recorded at once (SDD §8). */
export const parallelScenes = 4;
/** Tries per scene before it counts as failed (API §7). */
export const attemptsPerScene = 3;

type Halt = { halt: "stopped" } | { halt: "failed"; error: JobErrorInfo };

/** How a voice failure reads on a scene and, when nothing was recorded, on the job. */
function sceneError(error: unknown): SceneError & { retryable: boolean } {
  if (isTtsError(error)) {
    const message = {
      TTS_AUTH: "The voice service isn't set up correctly.",
      TTS_VOICE: "The narrator's voice isn't available.",
      TTS_RATE_LIMIT: "The voice service is busy.",
      TTS_REJECTED: "The voice service couldn't read this scene's narration.",
      TTS_FAILED: "The voice service didn't answer.",
    }[error.code];
    return { code: error.code, message, retryable: error.retryable };
  }
  return {
    code: "NARRATION_FAILED",
    message: "This scene's narration couldn't be saved.",
    retryable: true,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SceneResult =
  | { sceneId: string; recording: Recording; cached: boolean }
  | { sceneId: string; error: SceneError & { retryable: boolean } };

export function createNarrationJobs(inngest: Inngest, deps: NarrationJobDeps) {
  const { jobs, narration } = deps;
  const delay = deps.retryDelayMs ?? 1000;

  /** One scene: the cache, or the voice service up to 3 times. Runs inside its own step. */
  async function narrateScene(
    job: NarrationJob,
    task: NarrationTask,
    userId: string,
  ): Promise<SceneResult> {
    const cached = await narration.findRecording(job, task.hash);
    if (cached) {
      await narration.markScene(job, task.sceneId, { status: "skipped" });
      return { sceneId: task.sceneId, recording: cached, cached: true };
    }
    await narration.markScene(job, task.sceneId, { status: "running" });
    let last: SceneError & { retryable: boolean } = sceneError(null);
    for (let attempt = 1; attempt <= attemptsPerScene; attempt++) {
      try {
        const recording = await narration.record(job, task, userId, attempt);
        await narration.markScene(job, task.sceneId, { status: "done", attempts: attempt });
        return { sceneId: task.sceneId, recording, cached: false };
      } catch (error) {
        last = sceneError(error);
        if (!last.retryable || attempt === attemptsPerScene) {
          await narration.markScene(job, task.sceneId, {
            status: "failed",
            attempts: attempt,
            error: { code: last.code, message: last.message },
          });
          return { sceneId: task.sceneId, error: last };
        }
        await sleep(delay * 2 ** (attempt - 1));
      }
    }
    return { sceneId: task.sceneId, error: last };
  }

  const body =
    (type: "generate" | "scene_retry") =>
    async ({
      event,
      step,
      runId,
    }: {
      event: { data: NarrationJob };
      step: {
        run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
      };
      runId: string;
    }) => {
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
      const inputs = await step.run("load", () => narration.load(job, type));
      if (!inputs) return halt({ halt: "stopped" });
      // Step results come back as JSON: the spec is plain JSON already.
      const spec = inputs.spec as VideoSpec;
      const { userId } = inputs;

      const checked = await step.run("moderate", async (): Promise<Halt | { ok: true }> => {
        const going = await jobs.advance(job, {
          stage: "moderation",
          progress: 2,
          message: "Checking the narration",
        });
        if (!going) return { halt: "stopped" };
        const texts: ModerationInput[] = [
          { kind: "script", text: spec.scenes.map((s) => s.narration).join("\n\n") },
          { kind: "scene_text", text: onScreenText(spec) },
        ];
        try {
          const result = await moderate(deps.small(), texts, {
            onAttempt: deps.usage(job, userId, "moderation"),
          });
          if (result.decision === "allow") return { ok: true };
          await narration.recordModeration(job, userId, result);
          return {
            halt: "failed",
            error: { code: "CONTENT_BLOCKED", message: result.reason, retryable: false },
          };
        } catch (error) {
          if (isLlmError(error)) {
            return { halt: "failed", error: llmJobError(error, "check the narration") };
          }
          throw error;
        }
      });
      if ("halt" in checked) return halt(checked);

      const tasks = narrationTasks(
        spec,
        type === "generate" ? spec.scenes.map((s) => s.id) : (inputs.sceneIds ?? undefined),
      );
      const total = tasks.length;
      const begun = await step.run("scenes", async () => {
        await narration.setScenes(
          job,
          tasks.map((task) => ({ sceneId: task.sceneId, status: "pending" as const })),
        );
        return jobs.advance(job, {
          stage: "narration",
          progress: 5,
          message: `Recording narration (0 of ${total} scenes)`,
        });
      });
      if (!begun) return halt({ halt: "stopped" });

      const recordings: Record<string, Recording> = {};
      const failures: Record<string, SceneError & { retryable: boolean }> = {};
      for (let from = 0; from < total; from += parallelScenes) {
        const batch = tasks.slice(from, from + parallelScenes);
        // One step per batch: its scenes run at once inside it. A retried batch finds the
        // scenes it already recorded in the cache, so none is paid for twice.
        const results = await step.run(`narrate-${from}`, () =>
          Promise.all(batch.map((task) => narrateScene(job, task, userId))),
        );
        for (const result of results as SceneResult[]) {
          if ("recording" in result) recordings[result.sceneId] = result.recording;
          else failures[result.sceneId] = result.error;
        }
        const done = Math.min(total, from + batch.length);
        const going = await step.run(`progress-${from}`, () =>
          jobs.advance(job, {
            stage: "narration",
            progress: 5 + Math.round((75 * done) / total),
            message: `Recording narration (${done} of ${total} scenes)`,
          }),
        );
        if (!going) return halt({ halt: "stopped" });
      }

      const failedSceneIds = tasks.map((t) => t.sceneId).filter((id) => failures[id]);
      if (failedSceneIds.length === total) {
        const first = failures[failedSceneIds[0]!]!;
        return halt({
          halt: "failed",
          error: {
            code: first.code,
            message: `${first.message} No narration was recorded. Try again.`,
            retryable: first.retryable,
          },
        });
      }

      const timed = await step.run("timing", async () => {
        const going = await jobs.advance(job, {
          stage: "timing",
          progress: 85,
          message: "Timing every visual to its word",
        });
        return going ? withTimings(spec, recordings) : null;
      });
      if (!timed) return halt({ halt: "stopped" });

      const saved = await step.run("save", async () => {
        const going = await jobs.advance(job, {
          stage: "save",
          progress: 92,
          message: "Saving the version",
        });
        return going ? narration.save(job, timed as VideoSpec, inputs) : null;
      });
      if (!saved) return halt({ halt: "stopped" });

      const status = failedSceneIds.length > 0 ? ("partial" as const) : ("succeeded" as const);
      await step.run("finish", () =>
        jobs.finish(job, {
          status,
          result: { type, versionNumber: saved.versionNumber, failedSceneIds },
        }),
      );
      return { outcome: status, versionNumber: saved.versionNumber, failedSceneIds };
    };

  const shared = {
    // SDD §8: one run per project at a time; every step retries 3 times.
    retries: 3 as const,
    concurrency: { key: "event.data.projectId", limit: 1 },
    cancelOn: [{ event: jobCancelRequested, match: "data.jobId" }],
    onFailure: markJobFailed(jobs),
  };

  return [
    inngest.createFunction(
      {
        id: "generate-video",
        name: "Generate the video",
        triggers: [generateRequested],
        ...shared,
      },
      body("generate"),
    ),
    inngest.createFunction(
      {
        id: "retry-scene",
        name: "Record scenes again",
        triggers: [sceneRetryRequested],
        ...shared,
      },
      body("scene_retry"),
    ),
  ] as const;
}
