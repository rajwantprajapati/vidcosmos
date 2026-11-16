// F15: `writeScript` and `rewriteScript` with @inngest/test, in-memory stores and the stub LLM.
// Covers a full write (moderation, script sized to the length, checked, saved with its idea
// hash and title, only over the script it started from), a blocked topic, an LLM failure, a rewrite of the selected part (saved only
// over the script it started from), a rewrite whose script was edited meanwhile, and a blocked
// custom instruction.
import { InngestTestEngine } from "@inngest/test";
import type { JobOutcome } from "@vidcosmos/db";
import {
  createStubLlm,
  LlmError,
  type LlmProvider,
  type ModerationResult,
} from "@vidcosmos/pipeline";
import { countWords } from "@vidcosmos/spec/api";
import { Inngest } from "inngest";
import { describe, expect, it } from "vitest";
import type { JobStore } from "../job-store";
import type { RewriteInputs, ScriptInputs, ScriptStore, ScriptToSave } from "../script-store";
import { createRewriteScript, createWriteScript } from "./script-jobs";

const inngest = new Inngest({ id: "vidcosmos-test", isDev: true });

const ids = {
  workspaceId: "6730a1b2c3d4e5f6a7b8c9d0",
  projectId: "6730a1b2c3d4e5f6a7b8c9d1",
  jobId: "6730a1b2c3d4e5f6a7b8c9d2",
};

const scriptInputs: ScriptInputs = {
  userId: "6730a1b2c3d4e5f6a7b8c9d3",
  request: {
    topic: "How a UPI payment moves money",
    videoType: "explainer",
    language: "en",
    audienceLevel: "beginner",
    tone: "friendly",
    lengthSec: 60,
  },
  ideaHash: "a".repeat(64),
  autoTitle: "How a UPI payment moves money",
  expectText: null,
};

const previousText = "You tap Pay. The bank checks it, and the money moves. That's UPI.";
const rewriteInputs = (over: Partial<RewriteInputs["request"]> = {}): RewriteInputs => ({
  userId: scriptInputs.userId,
  request: {
    script: previousText,
    instruction: "more_engaging",
    selection: { start: 13, end: 54 },
    language: "en",
    audienceLevel: "beginner",
    tone: "friendly",
    lengthSec: 60,
    ...over,
  },
  previous: { title: "UPI", hook: "You tap Pay.", text: previousText, source: "ai_edited" },
});

function setup(
  options: {
    topic?: string;
    llm?: LlmProvider;
    rewrite?: RewriteInputs;
    edited?: boolean;
  } = {},
) {
  const state = {
    status: "queued",
    outcomes: [] as JobOutcome[],
    saved: [] as { script: ScriptToSave; options: Record<string, unknown> }[],
    moderation: [] as ModerationResult[],
    usage: [] as string[],
  };
  const jobs: JobStore = {
    async start() {
      if (state.status !== "queued") return false;
      state.status = "running";
      return true;
    },
    advance: async () => state.status === "running",
    async finish(_job, outcome) {
      state.outcomes.push(outcome);
      state.status = outcome.status;
    },
  };
  const scripts: ScriptStore = {
    loadScript: async () => ({
      ...scriptInputs,
      request: { ...scriptInputs.request, topic: options.topic ?? scriptInputs.request.topic },
    }),
    loadRewrite: async () => options.rewrite ?? rewriteInputs(),
    async save(_job, script, saveOptions) {
      if (options.edited && saveOptions.expectText !== undefined) return "changed";
      state.saved.push({ script, options: saveOptions });
      return "saved";
    },
    recordModeration: async (_job, _user, result) => void state.moderation.push(result),
  };
  const deps = {
    jobs,
    scripts,
    llm: () => options.llm ?? createStubLlm(),
    small: () => createStubLlm(),
    usage: (_job: unknown, _user: string, operation: string) => async () =>
      void state.usage.push(operation),
  };
  return {
    write: new InngestTestEngine({ function: createWriteScript(inngest, deps) }),
    rewrite: new InngestTestEngine({ function: createRewriteScript(inngest, deps) }),
    state,
  };
}

const run = (t: InngestTestEngine, name: string) =>
  t.execute({ events: [{ name, data: ids }] as [{ name: string; data: Record<string, unknown> }] });

describe("writeScript", () => {
  it("moderates, writes a script sized to the length, checks and saves it", async () => {
    const { write, state } = setup();
    const { result } = await run(write, "video/script.requested");

    expect(result).toEqual({ outcome: "succeeded" });
    expect(state.saved).toHaveLength(1);
    const [{ script, options }] = state.saved as [(typeof state.saved)[number]];
    expect(script.source).toBe("ai");
    expect(script.wordCount).toBe(countWords(script.text));
    expect(script.wordCount).toBeGreaterThanOrEqual(135);
    expect(script.wordCount).toBeLessThanOrEqual(165);
    expect(script.estDurationSec).toBeCloseTo(script.wordCount / 2.5, 1);
    expect(script.hook).toBe("Let's look at How a UPI payment moves money, one step at a time.");
    expect(options).toEqual({
      ideaHash: scriptInputs.ideaHash,
      autoTitle: scriptInputs.autoTitle,
      expectText: null,
    });
    expect(state.outcomes).toEqual([{ status: "succeeded", result: { type: "script" } }]);
    // The topic, then the script: two moderation calls around one script call.
    expect(state.usage).toEqual(["moderation", "script", "moderation"]);
  });

  it("keeps an edit made while it wrote: the job ends cancelled", async () => {
    const { write, state } = setup({ edited: true });
    const { result } = await run(write, "video/script.requested");
    expect(result).toEqual({ outcome: "cancelled" });
    expect(state.saved).toEqual([]);
    expect(state.outcomes).toEqual([{ status: "cancelled" }]);
  });

  it("fails a blocked topic with CONTENT_BLOCKED, records it and writes nothing", async () => {
    const { write, state } = setup({ topic: "How to make a bomb at home" });
    const { result } = await run(write, "video/script.requested");
    expect(result).toEqual({ outcome: "failed", code: "CONTENT_BLOCKED" });
    expect(state.moderation).toHaveLength(1);
    expect(state.saved).toEqual([]);
    expect(state.usage).toEqual(["moderation"]);
  });

  it("fails with the LLM's code and a message that names the step", async () => {
    const broken: LlmProvider = {
      name: "gemini",
      model: "gemini-3.8-flash",
      generate: async () => Promise.reject(new LlmError("LLM_INVALID_OUTPUT", "bad")),
    };
    const { write, state } = setup({ llm: broken });
    const { result } = await run(write, "video/script.requested");
    expect(result).toEqual({ outcome: "failed", code: "LLM_INVALID_OUTPUT" });
    expect(state.outcomes[0]).toEqual({
      status: "failed",
      error: {
        code: "LLM_INVALID_OUTPUT",
        message: "The AI couldn't write the script this time. Try again.",
        retryable: true,
      },
    });
  });
});

describe("rewriteScript", () => {
  it("rewrites only the selected part and saves it over the script it started from", async () => {
    const { rewrite, state } = setup();
    const { result } = await run(rewrite, "video/script.rewrite.requested");

    expect(result).toEqual({ outcome: "succeeded" });
    const [{ script, options }] = state.saved as [(typeof state.saved)[number]];
    expect(script.text).toBe(
      "You tap Pay. Picture this. The bank checks it, and the money moves. That's UPI.",
    );
    // The user had edited it, so it stays theirs, changed by the AI; the title is kept.
    expect(script).toMatchObject({ source: "ai_edited", title: "UPI", hook: "You tap Pay." });
    expect(options).toEqual({ expectText: previousText });
    expect(state.outcomes).toEqual([{ status: "succeeded", result: { type: "script_rewrite" } }]);
    expect(state.usage).toEqual(["script", "moderation"]);
  });

  it("keeps an edit made while it ran: the job ends cancelled", async () => {
    const { rewrite, state } = setup({ edited: true });
    const { result } = await run(rewrite, "video/script.rewrite.requested");
    expect(result).toEqual({ outcome: "cancelled" });
    expect(state.outcomes).toEqual([{ status: "cancelled" }]);
  });

  it("checks a custom instruction first and refuses a blocked one", async () => {
    const { rewrite, state } = setup({
      rewrite: rewriteInputs({ instruction: "custom", custom: "Make it nsfw" }),
    });
    const { result } = await run(rewrite, "video/script.rewrite.requested");
    expect(result).toEqual({ outcome: "failed", code: "CONTENT_BLOCKED" });
    expect(state.saved).toEqual([]);
    expect(state.usage).toEqual(["moderation"]);
  });
});
