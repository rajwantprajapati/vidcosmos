// F11: the demo job with @inngest/test, against an in-memory job store. Covers a full run;
// cancel (the run stops at the next step and the job ends cancelled); retry (a step that fails
// on the first attempt succeeds on Inngest's retry, and progress never goes back); a job that
// fails for good (`onFailure` marks it failed, retryable); and the handler that ends a job
// whose run Inngest cancelled. The engine doesn't model retries itself ("any error halts
// execution"), so a retry is a second execution with `attempt: 1`, as Inngest would send it.
import { InngestTestEngine } from "@inngest/test";
import type { JobOutcome, JobProgress } from "@vidcosmos/db";
import { Inngest } from "inngest";
import { describe, expect, it } from "vitest";
import { type JobStore, markJobFailed } from "../job-store";
import { createDemoJob, DemoFailure, demoStages } from "./demo-job";
import { createJobCancelled } from "./job-cancelled";

const inngest = new Inngest({ id: "vidcosmos-test", isDev: true });

const job = {
  workspaceId: "6730a1b2c3d4e5f6a7b8c9d0",
  projectId: "6730a1b2c3d4e5f6a7b8c9d1",
  jobId: "6730a1b2c3d4e5f6a7b8c9d2",
};

/** A job store in memory with the real store's rules, which can be asked to stop the job. */
function memoryStore() {
  const state = {
    status: "queued",
    cancelAsked: false,
    progress: 0,
    advances: [] as JobProgress[],
    outcomes: [] as JobOutcome[],
  };
  const isActive = () => state.status === "queued" || state.status === "running";
  const store: JobStore = {
    async start() {
      if (!isActive() || state.cancelAsked) return false;
      state.status = "running";
      return true;
    },
    async advance(_job, update) {
      if (state.status !== "running" || state.cancelAsked) return false;
      state.advances.push(update);
      state.progress = Math.max(state.progress, update.progress);
      return true;
    },
    async finish(_job, outcome) {
      state.outcomes.push(outcome);
      if (isActive()) state.status = outcome.status;
    },
  };
  return { store, state };
}

type Mode = "succeed" | "fail_once" | "fail";
const demoEvent = (mode: Mode = "succeed") =>
  [{ name: "job/demo.requested", data: { ...job, mode } }] as [
    { name: string; data: Record<string, unknown> },
  ];

/** Sleeps resolve at once; `onStage` runs before the given stage's progress write. */
function engine(store: JobStore, onStage?: Record<string, () => void>) {
  return new InngestTestEngine({
    function: createDemoJob(inngest, store, { pause: "1s" }),
    steps: demoStages.map((stage) => ({
      id: `wait-${stage.id}`,
      handler: () => {
        onStage?.[stage.id]?.();
        return null;
      },
    })),
  });
}

const atAttempt = (attempt: number) => ({
  transformCtx: <T extends object>(ctx: T): T => ({ ...ctx, attempt }),
});

describe("demo job", () => {
  it("moves through every stage, then succeeds", async () => {
    const { store, state } = memoryStore();
    const { result } = await engine(store).execute({ events: demoEvent() });

    expect(result).toEqual({ outcome: "succeeded" });
    expect(state.advances.map((a) => a.progress)).toEqual(demoStages.map((s) => s.progress));
    expect(state.advances[2]).toEqual({
      stage: "narration",
      progress: 40,
      message: "Recording narration (1 of 3 scenes)",
    });
    expect(state.outcomes).toEqual([{ status: "succeeded", result: { type: "demo" } }]);
  });

  it("cancel: stops at the next step and ends cancelled", async () => {
    const { store, state } = memoryStore();
    // Cancel is asked while the third stage is waiting.
    const t = engine(store, { "narrate-1": () => (state.cancelAsked = true) });
    const { result } = await t.execute({ events: demoEvent() });

    expect(result).toEqual({ outcome: "cancelled" });
    expect(state.advances.map((a) => a.stage)).toEqual(["moderation", "llm"]);
    expect(state.outcomes).toEqual([{ status: "cancelled" }]);
    expect(state.status).toBe("cancelled");
  });

  it("cancel: a job cancelled before its run started doesn't run", async () => {
    const { store, state } = memoryStore();
    state.status = "cancelled";
    const { result } = await engine(store).execute({ events: demoEvent() });
    expect(result).toEqual({ outcome: "skipped" });
    expect(state.advances).toHaveLength(0);
  });

  it("retry: a step that fails once succeeds on Inngest's retry", async () => {
    const { store, state } = memoryStore();
    const first = await engine(store).execute({ events: demoEvent("fail_once"), ...atAttempt(0) });
    // Errors come back serialised, as Inngest stores them.
    expect(first.error).toMatchObject({ name: DemoFailure.name });
    expect(state.status).toBe("running");
    const reached = state.progress;

    const second = await engine(store).execute({ events: demoEvent("fail_once"), ...atAttempt(1) });
    expect(second.result).toEqual({ outcome: "succeeded" });
    expect(state.status).toBe("succeeded");
    // Stages before the failure ran again (no memoised state between executions here), but
    // progress only went forward.
    expect(state.progress).toBeGreaterThan(reached);
    expect(state.outcomes).toEqual([{ status: "succeeded", result: { type: "demo" } }]);
  });

  it("retry: a step that keeps failing fails the run on every attempt", async () => {
    const { store, state } = memoryStore();
    for (const attempt of [0, 1]) {
      const run = await engine(store).execute({ events: demoEvent("fail"), ...atAttempt(attempt) });
      expect(run.error).toMatchObject({ name: DemoFailure.name });
    }
    expect(state.outcomes).toEqual([]);
  });
});

describe("when retries run out", () => {
  const failed = inngest.createFunction(
    { id: "demo-job-failure", triggers: [{ event: "inngest/function.failed" }] },
    async (ctx) => markJobFailed(memory.store)(ctx),
  );
  const memory = memoryStore();

  it("marks the job failed with a retryable error", async () => {
    memory.state.status = "running";
    const t = new InngestTestEngine({ function: failed });
    await t.execute({
      events: [
        {
          name: "inngest/function.failed",
          data: {
            function_id: "vidcosmos-demo-job",
            run_id: "01JC8",
            error: { name: "DemoFailure", message: "The demo job failed on purpose." },
            event: { name: "job/demo.requested", data: { ...job, mode: "fail" } },
          },
        },
      ],
    });
    expect(memory.state.status).toBe("failed");
    expect(memory.state.outcomes).toEqual([
      {
        status: "failed",
        error: { code: "INTERNAL", message: "Something went wrong. Try again.", retryable: true },
      },
    ]);
  });
});

describe("when Inngest cancels a run", () => {
  const cancelledEvent = (data: Record<string, unknown>) =>
    [{ name: "inngest/function.cancelled", data }] as [
      { name: string; data: Record<string, unknown> },
    ];

  it("ends the job cancelled", async () => {
    const { store, state } = memoryStore();
    state.status = "running";
    const t = new InngestTestEngine({ function: createJobCancelled(inngest, store) });
    const { result } = await t.execute({
      events: cancelledEvent({
        function_id: "vidcosmos-demo-job",
        run_id: "01JC8",
        event: { name: "job/demo.requested", data: { ...job, mode: "succeed" } },
      }),
    });
    expect(result).toEqual({ outcome: "cancelled" });
    expect(state.status).toBe("cancelled");
  });

  it("ignores runs that weren't started by a job event", async () => {
    const { store, state } = memoryStore();
    const t = new InngestTestEngine({ function: createJobCancelled(inngest, store) });
    const { result } = await t.execute({
      events: cancelledEvent({ function_id: "other", run_id: "01JC9", event: { data: {} } }),
    });
    expect(result).toEqual({ outcome: "ignored" });
    expect(state.outcomes).toEqual([]);
  });
});
