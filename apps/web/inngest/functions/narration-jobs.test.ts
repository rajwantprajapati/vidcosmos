// F20: `generateVideo`, `retryScene` and `failStuckJobs` with @inngest/test, an in-memory store,
// the stub voice and the stub LLM. Covers the happy path, one scene failing while the others
// finish, cached scenes, nothing recorded, a cancel, a blocked narration, a retry of the
// failed scenes, and a stuck job.
import { InngestTestEngine } from "@inngest/test";
import type { JobOutcome } from "@vidcosmos/db";
import { createStubTts, TtsError, type TtsProvider } from "@vidcosmos/integrations";
import { createStubLlm, type NarrationTask, type Recording } from "@vidcosmos/pipeline";
import { exampleScenes, type VideoSpec } from "@vidcosmos/spec/video";
import { testSpec } from "@vidcosmos/spec/video/testing";
import { Inngest } from "inngest";
import { describe, expect, it } from "vitest";
import type { JobKey, JobStore } from "../job-store";
import type { JobSceneStatus, NarrationInputs, NarrationStore } from "../narration-store";
import { attemptsPerScene, createNarrationJobs } from "./narration-jobs";
import { createFailStuckJobs, stuckJobError } from "./stuck-jobs";

const inngest = new Inngest({ id: "vidcosmos-test", isDev: true });

const ids = {
  workspaceId: "6730a1b2c3d4e5f6a7b8c9d0",
  projectId: "6730a1b2c3d4e5f6a7b8c9d1",
  jobId: "6730a1b2c3d4e5f6a7b8c9d2",
};

const scenes = [
  exampleScenes.title,
  exampleScenes.flowchart,
  exampleScenes.bullets,
  exampleScenes.comparison,
  exampleScenes.recap,
];

type Options = {
  spec?: VideoSpec;
  /** Narration that the voice service refuses (every attempt). */
  failing?: (text: string) => TtsError | null;
  /** Hashes already in the cache. */
  cached?: string[];
  sceneIds?: string[] | null;
  /** The job is asked to stop once this many scenes are done. */
  stopAfter?: number;
  llm?: ReturnType<typeof createStubLlm>;
};

function setup(options: Options = {}) {
  const spec = options.spec ?? testSpec(scenes);
  const state = {
    status: "queued",
    outcomes: [] as JobOutcome[],
    progress: [] as { stage?: string; progress: number; message?: string }[],
    scenes: new Map<string, { status: JobSceneStatus; attempts?: number }>(),
    calls: [] as string[],
    saved: [] as VideoSpec[],
    cache: new Set(options.cached ?? []),
    moderation: 0,
  };
  const tts: TtsProvider = createStubTts({
    failWith: (request) => options.failing?.(request.text) ?? null,
  });
  const jobs: JobStore = {
    async start() {
      if (state.status !== "queued") return false;
      state.status = "running";
      return true;
    },
    async advance(_job, update) {
      if (state.status !== "running") return false;
      const done = [...state.scenes.values()].filter((s) => s.status === "done").length;
      if (options.stopAfter !== undefined && done >= options.stopAfter) return false;
      state.progress.push(update);
      return true;
    },
    async finish(_job, outcome) {
      state.outcomes.push(outcome);
      state.status = outcome.status;
    },
  };
  const recordingOf = (task: NarrationTask, durationMs: number, words: Recording["words"]) => ({
    assetId: "6730a1b2c3d4e5f6a7b8c9d9",
    hash: task.hash,
    durationMs,
    words,
    timingSource: "estimated" as const,
  });
  const narration: NarrationStore = {
    load: async (_job, type): Promise<NarrationInputs> => ({
      type,
      userId: "6730a1b2c3d4e5f6a7b8c9d3",
      spec,
      baseRev: 3,
      sceneIds: options.sceneIds ?? null,
    }),
    async setScenes(_job, list) {
      for (const scene of list) state.scenes.set(scene.sceneId, { status: scene.status });
    },
    async markScene(_job, sceneId, update) {
      state.scenes.set(sceneId, update);
    },
    async findRecording(_job, hash) {
      if (!state.cache.has(hash)) return null;
      return {
        assetId: "6730a1b2c3d4e5f6a7b8c9d8",
        hash,
        durationMs: 4000,
        words: [{ text: "Hi", startMs: 0, endMs: 300 }],
        timingSource: "provider",
      };
    },
    async record(_job, task) {
      state.calls.push(task.sceneId);
      const speech = await tts.synthesize(task);
      return recordingOf(task, speech.durationMs, speech.words);
    },
    async save(_job, saved) {
      state.saved.push(saved);
      return { versionNumber: 2, created: true };
    },
    recordModeration: async () => void state.moderation++,
  };
  const [generate, retry] = createNarrationJobs(inngest, {
    jobs,
    narration,
    small: () => options.llm ?? createStubLlm(),
    usage: () => async () => {},
    retryDelayMs: 0,
  });
  const run = (fn: typeof generate | typeof retry, name: string) =>
    new InngestTestEngine({ function: fn }).execute({
      events: [{ name, data: ids }] as [{ name: string; data: Record<string, unknown> }],
    });
  return {
    spec,
    state,
    generate: () => run(generate, "video/generate.requested"),
    retry: () => run(retry, "video/scene.retry.requested"),
  };
}

describe("generateVideo", () => {
  it("records every scene, times them and saves a version", async () => {
    const { spec, state, generate } = setup();
    const { result } = await generate();

    expect(result).toEqual({ outcome: "succeeded", versionNumber: 2, failedSceneIds: [] });
    expect(state.calls).toEqual(spec.scenes.map((s) => s.id));
    const saved = state.saved[0]!;
    expect(saved.scenes.every((s) => s.timing !== null)).toBe(true);
    expect(saved.scenes[0]!.timing).toMatchObject({ leadInMs: 300 });
    expect(saved.scenes[0]!.timing!.durationMs).toBe(
      300 + saved.scenes[0]!.timing!.audioDurationMs + 400,
    );
    expect([...state.scenes.values()].every((s) => s.status === "done")).toBe(true);
    expect(state.outcomes).toEqual([
      {
        status: "succeeded",
        result: { type: "generate", versionNumber: 2, failedSceneIds: [] },
      },
    ]);
    // The stages in order, with the scene count, and progress that only goes up.
    expect(state.progress.map((p) => p.stage)).toEqual([
      "moderation",
      "narration",
      "narration",
      "narration",
      "timing",
      "save",
    ]);
    expect(state.progress[1]!.message).toBe("Recording narration (0 of 5 scenes)");
    expect(state.progress.at(-3)!.message).toBe("Recording narration (5 of 5 scenes)");
    const values = state.progress.map((p) => p.progress);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("saves the other scenes when one fails, and ends partial", async () => {
    const failing = (text: string) =>
      text === exampleScenes.bullets.narration
        ? new TtsError("TTS_FAILED", "down", 503, true)
        : null;
    const { spec, state, generate } = setup({ failing });
    const { result } = await generate();
    const failedId = spec.scenes[2]!.id;

    expect(result).toEqual({ outcome: "partial", versionNumber: 2, failedSceneIds: [failedId] });
    // Tried 3 times, then left without audio; the rest are timed.
    expect(state.calls.filter((id) => id === failedId)).toHaveLength(attemptsPerScene);
    expect(state.scenes.get(failedId)).toMatchObject({ status: "failed", attempts: 3 });
    const saved = state.saved[0]!;
    expect(saved.scenes[2]!.timing).toBeNull();
    expect(saved.scenes.filter((s) => s.timing !== null)).toHaveLength(4);
    expect(state.outcomes[0]).toMatchObject({ status: "partial" });
  });

  it("doesn't try again an error that won't change", async () => {
    const failing = (text: string) =>
      text === exampleScenes.recap.narration
        ? new TtsError("TTS_REJECTED", "no", 422, false)
        : null;
    const { spec, state, generate } = setup({ failing });
    await generate();
    expect(state.calls.filter((id) => id === spec.scenes[4]!.id)).toHaveLength(1);
  });

  it("reuses cached narration at no cost, marking those scenes skipped", async () => {
    const spec = testSpec(scenes);
    const { narrationTasks } = await import("@vidcosmos/pipeline");
    const cached = narrationTasks(spec)
      .slice(0, 2)
      .map((t) => t.hash);
    const { state, generate } = setup({ spec, cached });
    await generate();
    expect(state.calls).toEqual(spec.scenes.slice(2).map((s) => s.id));
    expect(state.scenes.get(spec.scenes[0]!.id)?.status).toBe("skipped");
    expect(state.saved[0]!.scenes[0]!.timing?.audioDurationMs).toBe(4000);
  });

  it("fails without saving when no scene could be recorded", async () => {
    const { state, generate } = setup({
      failing: () => new TtsError("TTS_AUTH", "no", 401, false),
    });
    const { result } = await generate();
    expect(result).toEqual({ outcome: "failed", code: "TTS_AUTH" });
    expect(state.saved).toEqual([]);
    expect(state.outcomes[0]).toMatchObject({
      status: "failed",
      error: { code: "TTS_AUTH", retryable: false },
    });
  });

  it("stops at the next step when asked to, and saves nothing", async () => {
    const { state, generate } = setup({ stopAfter: 4 });
    const { result } = await generate();
    expect(result).toEqual({ outcome: "cancelled" });
    expect(state.saved).toEqual([]);
    expect(state.outcomes).toEqual([{ status: "cancelled" }]);
  });

  it("ends failed when moderation blocks the narration", async () => {
    const llm = createStubLlm();
    const blocked = testSpec(scenes);
    blocked.scenes[0]!.narration = `${blocked.scenes[0]!.narration} How to build a bomb.`;
    const { state, generate } = setup({ spec: blocked, llm });
    const { result } = await generate();
    expect(result).toEqual({ outcome: "failed", code: "CONTENT_BLOCKED" });
    expect(state.calls).toEqual([]);
    expect(state.moderation).toBe(1);
  });
});

describe("retryScene", () => {
  it("records only the scenes asked for and saves a version", async () => {
    const spec = testSpec(scenes, { timed: true });
    const { state, retry } = setup({ spec, sceneIds: [spec.scenes[1]!.id] });
    const { result } = await retry();
    expect(result).toEqual({ outcome: "succeeded", versionNumber: 2, failedSceneIds: [] });
    expect(state.calls).toEqual([spec.scenes[1]!.id]);
    expect(state.outcomes[0]).toMatchObject({ result: { type: "scene_retry" } });
  });

  it("without a list, records the scenes that have no current narration", async () => {
    const spec = testSpec(scenes, { timed: true });
    spec.scenes[3]!.timing = null;
    const { state, retry } = setup({ spec, sceneIds: null });
    await retry();
    expect(state.calls).toEqual([spec.scenes[3]!.id]);
  });
});

describe("failStuckJobs", () => {
  it("fails every job that stopped responding with a retryable error", async () => {
    const finished: { job: JobKey; outcome: JobOutcome }[] = [];
    const stuck = [
      { workspaceId: ids.workspaceId, jobId: ids.jobId },
      { workspaceId: ids.workspaceId, jobId: "6730a1b2c3d4e5f6a7b8c9d7" },
    ];
    const fn = createFailStuckJobs(inngest, {
      jobs: {
        start: async () => true,
        advance: async () => true,
        finish: async (job, outcome) => void finished.push({ job, outcome }),
      },
      findStuck: async () => stuck,
    });
    const { result } = await new InngestTestEngine({ function: fn }).execute({
      events: [{ name: "inngest/scheduled.timer", data: { cron: "*/10 * * * *" } }] as [
        { name: string; data: Record<string, unknown> },
      ],
    });
    expect(result).toEqual({ failed: 2 });
    expect(finished.map((f) => f.job.jobId)).toEqual(stuck.map((s) => s.jobId));
    expect(finished[0]!.outcome).toEqual({ status: "failed", error: stuckJobError });
  });
});
