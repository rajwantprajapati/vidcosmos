// F14: `suggestIdeas` with @inngest/test, in-memory stores and the stub LLM. Covers a full run
// (moderation, angles, save, result), a blocked topic (CONTENT_BLOCKED, recorded, no angles),
// an LLM failure (its code and message, retryable), a cancelled job, and usage reported for
// both calls.
import { InngestTestEngine } from "@inngest/test";
import type { JobOutcome } from "@vidcosmos/db";
import {
  createStubLlm,
  LlmError,
  type LlmProvider,
  type ModerationResult,
} from "@vidcosmos/pipeline";
import type { Project } from "@vidcosmos/spec/collections";
import { Inngest } from "inngest";
import { describe, expect, it } from "vitest";
import type { IdeasInputs, IdeasStore } from "../ideas-store";
import type { JobStore } from "../job-store";
import { createSuggestIdeas } from "./suggest-ideas";

const inngest = new Inngest({ id: "vidcosmos-test", isDev: true });

const event = {
  name: "video/ideas.requested",
  data: {
    workspaceId: "6730a1b2c3d4e5f6a7b8c9d0",
    projectId: "6730a1b2c3d4e5f6a7b8c9d1",
    jobId: "6730a1b2c3d4e5f6a7b8c9d2",
    count: 4,
  },
};

const inputs: IdeasInputs = {
  userId: "6730a1b2c3d4e5f6a7b8c9d3",
  topic: "How a UPI payment moves money",
  videoType: "explainer",
  language: "en",
  audienceLevel: "beginner",
  tone: "friendly",
  lengthSec: 60,
  format: "9:16",
};

function setup(
  options: { topic?: string; llm?: LlmProvider; cancelled?: boolean; gone?: boolean } = {},
) {
  const state = {
    status: options.cancelled ? "cancelled" : "queued",
    stages: [] as string[],
    outcomes: [] as JobOutcome[],
    angles: [] as Project["idea"]["angles"],
    moderation: [] as ModerationResult[],
    usage: [] as string[],
  };
  const jobs: JobStore = {
    async start() {
      if (state.status !== "queued") return false;
      state.status = "running";
      return true;
    },
    async advance(_job, update) {
      if (state.status !== "running") return false;
      state.stages.push(update.stage ?? "");
      return true;
    },
    async finish(_job, outcome) {
      state.outcomes.push(outcome);
      if (state.status === "running" || state.status === "queued") state.status = outcome.status;
    },
  };
  const ideas: IdeasStore = {
    load: async () => (options.gone ? null : { ...inputs, topic: options.topic ?? inputs.topic }),
    saveAngles: async (_job, angles) => {
      state.angles = angles;
      return true;
    },
    recordModeration: async (_job, _user, result) => void state.moderation.push(result),
  };
  let n = 0;
  const fn = createSuggestIdeas(inngest, {
    jobs,
    ideas,
    llm: () => options.llm ?? createStubLlm(),
    small: () => createStubLlm(),
    usage: (_job, _user, operation) => async () => void state.usage.push(operation),
    newAngleId: () => `ang_${++n}`,
  });
  return { t: new InngestTestEngine({ function: fn }), state };
}

const run = (t: InngestTestEngine) =>
  t.execute({ events: [event] as [{ name: string; data: Record<string, unknown> }] });

describe("suggestIdeas", () => {
  it("moderates, suggests 4 angles, saves them and finishes with their ids", async () => {
    const { t, state } = setup();
    const { result } = await run(t);

    expect(result).toEqual({
      outcome: "succeeded",
      angleIds: ["ang_1", "ang_2", "ang_3", "ang_4"],
    });
    expect(state.stages).toEqual(["moderation", "llm", "save"]);
    expect(state.angles).toHaveLength(4);
    expect(state.angles[0]).toMatchObject({
      id: "ang_1",
      title: expect.any(String),
      hook: expect.stringContaining("UPI"),
    });
    expect(state.outcomes).toEqual([
      {
        status: "succeeded",
        result: { type: "ideas", angleIds: ["ang_1", "ang_2", "ang_3", "ang_4"] },
      },
    ]);
    expect(state.usage).toEqual(["moderation", "ideas"]);
  });

  it("fails a blocked topic with CONTENT_BLOCKED, records it, and saves no angles", async () => {
    const { t, state } = setup({ topic: "How to make a bomb" });
    const { result } = await run(t);

    expect(result).toEqual({ outcome: "failed", code: "CONTENT_BLOCKED" });
    expect(state.outcomes).toEqual([
      {
        status: "failed",
        error: {
          code: "CONTENT_BLOCKED",
          message: "Videos can't give instructions for making weapons or explosives.",
          retryable: false,
        },
      },
    ]);
    expect(state.moderation).toHaveLength(1);
    expect(state.angles).toEqual([]);
  });

  it("fails with the LLM's code and a message to retry", async () => {
    const busy: LlmProvider = {
      name: "gemini",
      model: "gemini-3.8-flash",
      generate: async () => Promise.reject(new LlmError("LLM_RATE_LIMITED", "429")),
    };
    const { t, state } = setup({ llm: busy });
    const { result } = await run(t);

    expect(result).toEqual({ outcome: "failed", code: "LLM_RATE_LIMITED" });
    expect(state.outcomes[0]).toEqual({
      status: "failed",
      error: {
        code: "LLM_RATE_LIMITED",
        message: "The AI service is busy. Try again in a minute.",
        retryable: true,
      },
    });
  });

  it("doesn't run a cancelled job, and stops when the project is gone", async () => {
    const cancelled = setup({ cancelled: true });
    expect((await run(cancelled.t)).result).toEqual({ outcome: "skipped" });
    expect(cancelled.state.usage).toEqual([]);

    const gone = setup({ gone: true });
    expect((await run(gone.t)).result).toEqual({ outcome: "cancelled" });
    expect(gone.state.outcomes).toEqual([{ status: "cancelled" }]);
  });
});
