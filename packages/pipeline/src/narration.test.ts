// F20: which scenes need a recording, the timing step, and what a recording costs.
import { exampleScenes, narrationHash } from "@vidcosmos/spec/video";
import { testSpec } from "@vidcosmos/spec/video/testing";
import { describe, expect, it } from "vitest";
import {
  hasCurrentTiming,
  narrationCost,
  narrationTasks,
  type Recording,
  timingOf,
  withTimings,
} from "./narration.ts";

const recordingFor = (hash: string): Recording => ({
  assetId: "6730a1b2c3d4e5f6a7b8c9d0",
  hash,
  durationMs: 2000,
  words: [
    { text: "You", startMs: 0, endMs: 300 },
    { text: "tap", startMs: 400, endMs: 700 },
  ],
  timingSource: "provider",
});

describe("narration tasks", () => {
  it("lists every scene without a current recording, keyed by its narration hash", () => {
    const spec = testSpec([exampleScenes.title, exampleScenes.recap]);
    const tasks = narrationTasks(spec);
    expect(tasks.map((t) => t.sceneId)).toEqual(spec.scenes.map((s) => s.id));
    expect(tasks[0]!.hash).toBe(narrationHash(spec.scenes[0]!.narration, "en", spec.voice));
    expect(tasks[0]).toMatchObject({ language: "en", voiceId: spec.voice.voiceId });
  });

  it("skips recorded scenes unless they're asked for, and records asked-for ones in order", () => {
    const timed = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true });
    expect(narrationTasks(timed)).toEqual([]);
    expect(hasCurrentTiming(timed.scenes[0]!, timed)).toBe(true);
    const ids = timed.scenes.map((s) => s.id);
    expect(narrationTasks(timed, [ids[1]!, ids[0]!]).map((t) => t.sceneId)).toEqual(ids);
    // A voice change makes every recording stale.
    const otherVoice = { ...timed, voice: { ...timed.voice, speed: 1.1 } };
    expect(narrationTasks(otherVoice)).toHaveLength(2);
  });
});

describe("the timing step", () => {
  it("adds the lead-in and tail around the audio", () => {
    const timing = timingOf(recordingFor("a".repeat(64)));
    expect(timing).toMatchObject({
      leadInMs: 300,
      audioDurationMs: 2000,
      durationMs: 300 + 2000 + 400,
      timingSource: "provider",
    });
  });

  it("puts a recording only on a scene whose narration still matches it", () => {
    const spec = testSpec([exampleScenes.title, exampleScenes.recap]);
    const [first, second] = spec.scenes;
    const hash = (scene: typeof first) => narrationHash(scene!.narration, "en", spec.voice);
    const timed = withTimings(spec, {
      [first!.id]: recordingFor(hash(first)),
      [second!.id]: recordingFor("b".repeat(64)), // recorded from words that changed since
    });
    expect(timed.scenes[0]!.timing?.durationMs).toBe(2700);
    expect(timed.scenes[1]!.timing).toBeNull();
  });
});

describe("narration cost", () => {
  it("prices ElevenLabs by the character; the stub is free", () => {
    expect(narrationCost("elevenlabs", "eleven_multilingual_v2", 900).costMicroUsd).toBe(90_000);
    expect(narrationCost("stub", "eleven_multilingual_v2", 900).costMicroUsd).toBe(0);
    expect(narrationCost("elevenlabs", "unknown", 900)).toEqual({
      costMicroUsd: 0,
      priceVersion: "2026-11:unpriced",
    });
  });
});
