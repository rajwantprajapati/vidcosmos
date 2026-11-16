// `writeScript` and `rewriteScript` (SDD §8, API §6).
//
// writeScript:
//   1. start the job, load the idea, settings and the job's input (angle, instructions);
//   2. moderate the topic, notes and instructions (the script may be the first AI step);
//   3. ask the LLM for a script sized to the length: within ±10% of the target words, one
//      retry if not (`writeScript` in the pipeline), recording each call's usage;
//   4. moderate the script (API §6: both jobs moderate their output);
//   5. save it (`source: 'ai'`) with the idea and angle it was written from, and finish.
//      Like a rewrite, it's saved only over the script there was when it was asked for: an
//      edit made meanwhile stays, and the job ends cancelled, giving its request back.
// rewriteScript does the same with the script kept in the job's input: it moderates a custom
// instruction, rewrites all or the selected part, moderates the result and saves it only if
// the script hasn't been edited since (`ai`, or `ai_edited` when the user had edited it). A
// script edited meanwhile keeps the edit: the job ends cancelled and gives its request back.
//
// A refusal or an LLM failure ends the job `failed` with its code and message. Retries 2.
import {
  type LlmAttempt,
  type LlmProvider,
  moderate,
  type ModerationInput,
  rewriteScript,
  writeScript,
} from "@vidcosmos/pipeline";
import { firstSentence, scriptStats } from "@vidcosmos/spec/api";
import type { GetStepTools, Inngest } from "inngest";
import { type JobErrorInfo, isLlmError, llmJobError } from "../errors";
import { jobCancelRequested, scriptRequested, scriptRewriteRequested } from "../events";
import { type JobStore, markJobFailed } from "../job-store";
import type { RewriteJob, ScriptJob, ScriptStore, ScriptToSave } from "../script-store";

export type ScriptJobDeps = {
  jobs: JobStore;
  scripts: ScriptStore;
  /** The generation model and the small one (moderation). */
  llm: () => LlmProvider;
  small: () => LlmProvider;
  /** An `onAttempt` that records usage events for this job. */
  usage: (
    job: ScriptJob | RewriteJob,
    userId: string,
    operation: "script" | "moderation",
  ) => (attempt: LlmAttempt) => Promise<void>;
};

type Halt = { halt: "stopped" } | { halt: "failed"; error: JobErrorInfo };
type Step = GetStepTools<Inngest.Any>;

/** Ends the job as `halt` says and returns the run's outcome. */
async function haltJob(step: Step, deps: ScriptJobDeps, job: ScriptJob | RewriteJob, reason: Halt) {
  if (reason.halt === "failed") {
    await step.run("fail", () => deps.jobs.finish(job, { status: "failed", error: reason.error }));
    return { outcome: "failed" as const, code: reason.error.code };
  }
  await step.run("stop", () => deps.jobs.finish(job, { status: "cancelled" }));
  return { outcome: "cancelled" as const };
}

/** Moderates `texts`; a block is recorded and becomes the job's CONTENT_BLOCKED failure. */
async function moderateTexts(
  deps: ScriptJobDeps,
  job: ScriptJob | RewriteJob,
  userId: string,
  texts: ModerationInput[],
  what: string,
): Promise<Halt | { ok: true }> {
  try {
    const result = await moderate(deps.small(), texts, {
      onAttempt: deps.usage(job, userId, "moderation"),
    });
    if (result.decision === "allow") return { ok: true };
    await deps.scripts.recordModeration(job, userId, result);
    return {
      halt: "failed",
      error: { code: "CONTENT_BLOCKED", message: result.reason, retryable: false },
    };
  } catch (error) {
    if (isLlmError(error)) return { halt: "failed", error: llmJobError(error, what) };
    throw error;
  }
}

function toSave(
  title: string,
  text: string,
  language: "en" | "hi",
  source: ScriptToSave["source"],
): ScriptToSave {
  return { title, hook: firstSentence(text), text, ...scriptStats(text, language), source };
}

export function createWriteScript(inngest: Inngest, deps: ScriptJobDeps) {
  const { jobs, scripts } = deps;
  return inngest.createFunction(
    {
      id: "write-script",
      name: "Write the script",
      triggers: [scriptRequested],
      retries: 2,
      cancelOn: [{ event: jobCancelRequested, match: "data.jobId" }],
      onFailure: markJobFailed(jobs),
    },
    async ({ event, step, runId }) => {
      const job = event.data;
      const halt = (reason: Halt) => haltJob(step, deps, job, reason);

      if (!(await step.run("start", () => jobs.start(job, runId)))) {
        return { outcome: "skipped" as const };
      }
      const inputs = await step.run("load", () => scripts.loadScript(job));
      if (!inputs) return halt({ halt: "stopped" });
      const { request, userId } = inputs;

      const checked = await step.run("moderate", async (): Promise<Halt | { ok: true }> => {
        const going = await jobs.advance(job, {
          stage: "moderation",
          progress: 10,
          message: "Checking the topic",
        });
        if (!going) return { halt: "stopped" };
        return moderateTexts(
          deps,
          job,
          userId,
          [
            { kind: "topic", text: request.topic },
            ...(request.notes ? [{ kind: "notes" as const, text: request.notes }] : []),
            ...(request.instructions
              ? [{ kind: "topic" as const, text: request.instructions }]
              : []),
          ],
          "write the script",
        );
      });
      if ("halt" in checked) return halt(checked);

      const written = await step.run("write", async () => {
        const going = await jobs.advance(job, {
          stage: "llm",
          progress: 30,
          message: "Writing the script",
        });
        if (!going) return { halt: "stopped" } satisfies Halt;
        try {
          return {
            script: await writeScript(deps.llm(), request, {
              onAttempt: deps.usage(job, userId, "script"),
            }),
          };
        } catch (error) {
          if (isLlmError(error)) {
            return { halt: "failed", error: llmJobError(error, "write the script") } satisfies Halt;
          }
          throw error;
        }
      });
      if ("halt" in written) return halt(written as Halt);

      const reviewed = await step.run("check", async (): Promise<Halt | { ok: true }> => {
        const going = await jobs.advance(job, {
          stage: "moderation",
          progress: 80,
          message: "Checking the script",
        });
        if (!going) return { halt: "stopped" };
        return moderateTexts(
          deps,
          job,
          userId,
          [{ kind: "script", text: `${written.script.title}\n\n${written.script.text}` }],
          "write the script",
        );
      });
      if ("halt" in reviewed) return halt(reviewed);

      const saved = await step.run("save", async () => {
        const going = await jobs.advance(job, {
          stage: "save",
          progress: 90,
          message: "Saving the script",
        });
        if (!going) return "gone" as const;
        return scripts.save(
          job,
          toSave(written.script.title, written.script.text, request.language, "ai"),
          {
            ideaHash: inputs.ideaHash,
            autoTitle: inputs.autoTitle,
            ...(inputs.angleId ? { angleId: inputs.angleId } : {}),
            expectText: inputs.expectText,
          },
        );
      });
      if (saved !== "saved") return halt({ halt: "stopped" });

      await step.run("finish", () =>
        jobs.finish(job, { status: "succeeded", result: { type: "script" } }),
      );
      return { outcome: "succeeded" as const };
    },
  );
}

export function createRewriteScript(inngest: Inngest, deps: ScriptJobDeps) {
  const { jobs, scripts } = deps;
  return inngest.createFunction(
    {
      id: "rewrite-script",
      name: "Rewrite the script",
      triggers: [scriptRewriteRequested],
      retries: 2,
      cancelOn: [{ event: jobCancelRequested, match: "data.jobId" }],
      onFailure: markJobFailed(jobs),
    },
    async ({ event, step, runId }) => {
      const job = event.data;
      const halt = (reason: Halt) => haltJob(step, deps, job, reason);

      if (!(await step.run("start", () => jobs.start(job, runId)))) {
        return { outcome: "skipped" as const };
      }
      const inputs = await step.run("load", () => scripts.loadRewrite(job));
      if (!inputs) return halt({ halt: "stopped" });
      const { request, previous, userId } = inputs;

      if (request.custom) {
        const custom = request.custom;
        const checked = await step.run("moderate", async (): Promise<Halt | { ok: true }> => {
          const going = await jobs.advance(job, {
            stage: "moderation",
            progress: 10,
            message: "Checking your instruction",
          });
          if (!going) return { halt: "stopped" };
          return moderateTexts(
            deps,
            job,
            userId,
            [{ kind: "script", text: custom }],
            "rewrite the script",
          );
        });
        if ("halt" in checked) return halt(checked);
      }

      const rewritten = await step.run("rewrite", async () => {
        const going = await jobs.advance(job, {
          stage: "llm",
          progress: 30,
          message: "Rewriting the script",
        });
        if (!going) return { halt: "stopped" } satisfies Halt;
        try {
          return {
            text: await rewriteScript(deps.llm(), request, {
              onAttempt: deps.usage(job, userId, "script"),
            }),
          };
        } catch (error) {
          if (isLlmError(error)) {
            return {
              halt: "failed",
              error: llmJobError(error, "rewrite the script"),
            } satisfies Halt;
          }
          throw error;
        }
      });
      if ("halt" in rewritten) return halt(rewritten as Halt);

      const reviewed = await step.run("check", async (): Promise<Halt | { ok: true }> => {
        const going = await jobs.advance(job, {
          stage: "moderation",
          progress: 80,
          message: "Checking the script",
        });
        if (!going) return { halt: "stopped" };
        return moderateTexts(
          deps,
          job,
          userId,
          [{ kind: "script", text: rewritten.text }],
          "rewrite the script",
        );
      });
      if ("halt" in reviewed) return halt(reviewed);

      const saved = await step.run("save", async () => {
        const going = await jobs.advance(job, {
          stage: "save",
          progress: 90,
          message: "Saving the script",
        });
        if (!going) return "gone" as const;
        // Still the AI's own words, or the user's words the AI changed.
        const source = previous.source === "ai" ? "ai" : "ai_edited";
        return scripts.save(job, toSave(previous.title, rewritten.text, request.language, source), {
          expectText: previous.text,
        });
      });
      if (saved !== "saved") return halt({ halt: "stopped" });

      await step.run("finish", () =>
        jobs.finish(job, { status: "succeeded", result: { type: "script_rewrite" } }),
      );
      return { outcome: "succeeded" as const };
    },
  );
}
