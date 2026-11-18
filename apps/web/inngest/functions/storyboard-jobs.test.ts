// F17: `buildStoryboard` with @inngest/test, an in-memory store and the stub LLM. Covers a full
// build (the script moderated, scenes built and checked, the on-screen text moderated, saved
// with the new rev), a script or draft changed meanwhile, a blocked script, and an LLM failure.
import { InngestTestEngine } from "@inngest/test";
import type { JobOutcome } from "@vidcosmos/db";
import {
  createStubLlm,
  LlmError,
  type LlmProvider,
  type ModerationResult,
} from "@vidcosmos/pipeline";
import { specIssues, type VideoSpec } from "@vidcosmos/spec/video";
import { Inngest } from "inngest";
import { describe, expect, it } from "vitest";
import type { JobStore } from "../job-store";
import type { StoryboardInputs, StoryboardStore } from "../storyboard-store";
import { createBuildStoryboard, onScreenText } from "./storyboard-jobs";

const inngest = new Inngest({ id: "vidcosmos-test", isDev: true });

const ids = {
  workspaceId: "6730a1b2c3d4e5f6a7b8c9d0",
  projectId: "6730a1b2c3d4e5f6a7b8c9d1",
  jobId: "6730a1b2c3d4e5f6a7b8c9d2",
};

const script =
  "You tap Pay, and in about two seconds your friend has the money. But where does it actually go? Let's follow one UPI payment.\n\nFirst, your app sends the request to NPCI, the network that connects banks across India. NPCI checks which bank your friend uses and asks that bank to accept the money.\n\nTheir bank says yes, your bank sends the money, and both of you get a message. That's UPI: three hops, two seconds, and one PIN that only you know.";

const inputs = (text = script): StoryboardInputs => ({
  userId: "6730a1b2c3d4e5f6a7b8c9d3",
  request: {
    title: "How UPI moves your money",
    script: text,
    language: "en",
    lengthSec: 30,
    format: "9:16",
    voice: {
      gender: "female",
      voiceId: "voice_female_1",
      model: "eleven_multilingual_v2",
      speed: 1,
    },
    theme: { palette: "ocean", captionStyle: "highlight" },
    music: null,
  },
  baseRev: 4,
});

function setup(options: { script?: string; llm?: LlmProvider; changed?: boolean } = {}) {
  const state = {
    status: "queued",
    outcomes: [] as JobOutcome[],
    saved: [] as { spec: VideoSpec; baseRev: number }[],
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
  const storyboards: StoryboardStore = {
    load: async () => inputs(options.script),
    async save(_job, spec, loaded) {
      if (options.changed) return { saved: false };
      state.saved.push({ spec, baseRev: loaded.baseRev });
      return { saved: true, rev: loaded.baseRev + 1 };
    },
    recordModeration: async (_job, _user, result) => void state.moderation.push(result),
  };
  const engine = new InngestTestEngine({
    function: createBuildStoryboard(inngest, {
      jobs,
      storyboards,
      llm: () => options.llm ?? createStubLlm(),
      small: () => createStubLlm(),
      usage: (_job, _user, operation) => async () => void state.usage.push(operation),
    }),
  });
  const run = () =>
    engine.execute({
      events: [{ name: "video/storyboard.requested", data: ids }] as [
        { name: string; data: Record<string, unknown> },
      ],
    });
  return { run, state };
}

describe("buildStoryboard", () => {
  it("moderates the script, builds valid scenes, checks their text and saves them", async () => {
    const { run, state } = setup();
    const { result } = await run();

    expect(result).toEqual({ outcome: "succeeded" });
    const [{ spec, baseRev }] = state.saved as [(typeof state.saved)[number]];
    expect(baseRev).toBe(4);
    expect(specIssues(spec, { script })).toEqual([]);
    expect(spec).toMatchObject({
      title: "How UPI moves your money",
      theme: { palette: "ocean" },
      voice: { voiceId: "voice_female_1" },
    });
    expect(state.outcomes).toEqual([
      { status: "succeeded", result: { type: "storyboard", draftRev: 5 } },
    ]);
    // The script, then the storyboard, then its on-screen text.
    expect(state.usage).toEqual(["moderation", "storyboard", "moderation"]);
  });

  it("keeps a script or draft changed while it ran: the job ends cancelled", async () => {
    const { run, state } = setup({ changed: true });
    const { result } = await run();
    expect(result).toEqual({ outcome: "cancelled" });
    expect(state.outcomes).toEqual([{ status: "cancelled" }]);
  });

  it("fails a blocked script with CONTENT_BLOCKED, records it and builds nothing", async () => {
    const { run, state } = setup({ script: `${script} Then we build a bomb.` });
    const { result } = await run();
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
    const { run, state } = setup({ llm: broken });
    const { result } = await run();
    expect(result).toEqual({ outcome: "failed", code: "LLM_INVALID_OUTPUT" });
    expect(state.outcomes[0]).toEqual({
      status: "failed",
      error: {
        code: "LLM_INVALID_OUTPUT",
        message: "The AI couldn't build the storyboard this time. Try again.",
        retryable: true,
      },
    });
  });

  it("moderates what the viewer reads: headings and element labels, once each", () => {
    const text = onScreenText({
      version: 1,
      format: "9:16",
      title: "UPI",
      language: "en",
      voice: inputs().request.voice,
      theme: { palette: "ocean", captionStyle: "highlight" },
      music: null,
      scenes: [
        {
          id: "sc_1",
          template: "bullets",
          narration: "A bank and a phone.",
          userEdited: false,
          timing: null,
          content: {
            heading: "UPI",
            items: [
              { text: "A bank", trigger: "bank" },
              { text: "A phone", trigger: "phone" },
            ],
          },
        },
      ],
    } as VideoSpec);
    expect(text.split("\n")).toEqual(["UPI", "A bank", "A phone"]);
  });
});
